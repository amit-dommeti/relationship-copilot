import Papa from "papaparse";
import { unzipSync, strFromU8 } from "fflate";
import { normalizeContact, normalizeCircle, dateValue, DAY } from "./domain.js";

export function parseContacts(input) {
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/);
  const start = lines.findIndex((line) => {
    const fields = (Papa.parse(line).data[0] || []).map((h) =>
      h
        .trim()
        .toLowerCase()
        .replace(/[^a-z]/g, ""),
    );
    return (
      fields.includes("name") ||
      (fields.includes("firstname") && fields.includes("lastname"))
    );
  });
  if (start < 0)
    throw new Error(
      "No contact header found. Use LinkedIn's Connections.csv, or columns Name, Company, Role, URL.",
    );
  const parsed = Papa.parse(lines.slice(start).join("\n"), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) =>
      h
        .trim()
        .toLowerCase()
        .replace(/[^a-z]/g, ""),
  });
  if (parsed.errors.some((e) => e.type === "Quotes"))
    throw new Error(
      "The file has an unclosed quoted field. Export it as CSV again.",
    );
  const contacts = [],
    warnings = [];
  for (const [i, row] of parsed.data.entries()) {
    const name =
      row.name || [row.firstname, row.lastname].filter(Boolean).join(" ");
    if (!name?.trim()) {
      warnings.push(`Row ${i + 2}: missing name`);
      continue;
    }
    contacts.push(
      normalizeContact({
        name,
        company: row.company,
        role: row.position || row.role || row.title,
        url: row.url || row.linkedinurl || row.profileurl,
        email: row.emailaddress || row.email,
        connectedAt: row.connectedon,
        source: "import",
      }),
    );
  }
  if (!contacts.length)
    throw new Error("The file has headers but no contacts.");
  if (contacts.length > 10000)
    throw new Error("Import up to 10,000 contacts at a time.");
  return { contacts, circles: [], messages: [], warnings };
}
export function parseBackup(input) {
  let data;
  try {
    data = JSON.parse(input);
  } catch {
    throw new Error("This backup is not valid JSON.");
  }
  const raw = Array.isArray(data) ? data : data?.contacts;
  if (!Array.isArray(raw) || raw.length > 10000)
    throw new Error("This backup must contain up to 10,000 contacts.");
  const circles = Array.isArray(data.circles)
    ? data.circles.map(normalizeCircle)
    : [];
  // Preserve historical cluster membership when upgrading a v0 backup.
  for (const c of raw)
    if (c.cluster && !circles.some((g) => g.name === c.cluster))
      circles.push(
        normalizeCircle({ name: c.cluster, memory: c.clusterNote || "" }),
      );
  const contacts = raw.map((c) =>
    normalizeContact({
      ...c,
      lastContactAt: c.lastContactAt || c.lastSentAt,
      snoozedUntil:
        c.snoozedUntil ||
        (c.status === "snoozed" && dateValue(c.snoozedAt)
          ? new Date(dateValue(c.snoozedAt) + 7 * DAY).toISOString()
          : ""),
      latestMessageAt: c.latestMessageAt || c.lastReplyAt || c.lastSentAt,
      circleIds:
        c.circleIds ||
        circles.filter((g) => g.name === c.cluster).map((g) => g.id),
    }),
  );
  const messages = Array.isArray(data.messages)
    ? data.messages.map((m) => ({
        ...m,
        contactId:
          contacts[raw.findIndex((c) => c.id === m.contactId)]?.id ||
          m.contactId,
      }))
    : [];
  for (const [index, c] of raw.entries())
    if (c.latestReply)
      messages.push({
        id: `legacy-reply-${contacts[index].id}-${dateValue(c.lastReplyAt)}`,
        contactId: contacts[index].id,
        text: c.latestReply,
        direction: "in",
        at: c.lastReplyAt,
      });
  return {
    contacts,
    circles,
    messages,
    settings: data.settings,
    warnings: [],
  };
}
export async function importFile(file) {
  if (file.size > 20 * 1024 * 1024)
    throw new Error(
      "Use a file smaller than 20 MB, or choose Connections.csv from the archive.",
    );
  if (/\.zip$/i.test(file.name)) {
    let accepted = false;
    const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter: (e) => {
        if (
          accepted ||
          !/(^|\/)connections\.csv$/i.test(e.name) ||
          e.originalSize > 5 * 1024 * 1024
        )
          return false;
        accepted = true;
        return true;
      },
    });
    const match = Object.values(entries)[0];
    if (!match)
      throw new Error(
        "No Connections.csv found in this ZIP. Request Connections in your LinkedIn export.",
      );
    return parseContacts(strFromU8(match));
  }
  const content = await file.text();
  return /\.json$/i.test(file.name)
    ? parseBackup(content)
    : parseContacts(content);
}
