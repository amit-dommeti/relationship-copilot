export const DAY = 86400000;
export const nowISO = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export const safeId = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,180}$/.test(value)
    ? value
    : uid();
export const text = (value, max = 2000) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
export const fullName = (c) =>
  c.name || [c.firstName, c.lastName].filter(Boolean).join(" ");
export const dateValue = (value) => {
  const n = Date.parse(value);
  return Number.isFinite(n) ? n : 0;
};
export function profileURL(value) {
  try {
    const u = new URL(value);
    if (
      u.protocol !== "https:" ||
      !/(^|\.)linkedin\.com$/.test(u.hostname) ||
      !u.pathname.startsWith("/in/")
    )
      return "";
    return `https://www.linkedin.com${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return "";
  }
}
export function normalizeContact(raw = {}) {
  const name = text(fullName(raw), 120);
  if (!name) throw new Error("A name is required.");
  return {
    id: safeId(raw.id),
    name,
    company: text(raw.company, 150),
    role: text(raw.role || raw.position, 200),
    url: profileURL(raw.url || raw.linkedInUrl),
    email: text(raw.email, 200),
    relationship: text(raw.relationship, 80) || "Connection",
    circleIds: Array.isArray(raw.circleIds)
      ? [
          ...new Set(
            raw.circleIds.filter(
              (x) => typeof x === "string" && /^[a-zA-Z0-9_-]{1,180}$/.test(x),
            ),
          ),
        ].slice(0, 30)
      : [],
    memory: text(raw.memory, 4000),
    reason: text(raw.reason, 1000),
    cadence: Math.max(7, Math.min(365, Number(raw.cadence) || 60)),
    lastContactAt: dateValue(raw.lastContactAt)
      ? new Date(raw.lastContactAt).toISOString()
      : "",
    connectedAt: text(raw.connectedAt || raw.connectedOn, 50),
    snoozedUntil: dateValue(raw.snoozedUntil)
      ? new Date(raw.snoozedUntil).toISOString()
      : "",
    reminderAt: dateValue(raw.reminderAt)
      ? new Date(raw.reminderAt).toISOString()
      : "",
    needsReply: Boolean(raw.needsReply || raw.status === "needs reply"),
    archived: Boolean(raw.archived),
    favorite: Boolean(raw.favorite),
    draft: text(raw.draft || raw.lastDraft, 8000),
    providerId: text(raw.providerId, 250),
    chatId: text(raw.chatId, 500),
    latestMessageAt: text(raw.latestMessageAt, 50),
    source: ["manual", "import", "linkedin", "demo"].includes(raw.source)
      ? raw.source
      : "manual",
    createdAt: dateValue(raw.createdAt) ? raw.createdAt : nowISO(),
    updatedAt: nowISO(),
  };
}
export function normalizeCircle(raw) {
  if (!text(raw.name, 100)) throw new Error("Give this circle a name.");
  return {
    id: safeId(raw.id),
    name: text(raw.name, 100),
    memory: text(raw.memory, 4000),
    color: ["green", "violet", "blue", "rose", "amber"].includes(raw.color)
      ? raw.color
      : "green",
  };
}
export function mergeContacts(existing, incoming) {
  const result = existing.map((c) => ({ ...c }));
  let added = 0,
    updated = 0;
  const idMap = Object.create(null);
  for (const raw of incoming) {
    const next = normalizeContact(raw);
    const index = result.findIndex(
      (c) =>
        c.id === next.id ||
        (c.url && next.url && c.url.toLowerCase() === next.url.toLowerCase()) ||
        (c.email &&
          next.email &&
          c.email.toLowerCase() === next.email.toLowerCase()) ||
        (c.providerId && next.providerId && c.providerId === next.providerId),
    );
    if (index < 0) {
      result.push(next);
      added++;
      idMap[next.id] = next.id;
    } else {
      const prev = result[index];
      idMap[next.id] = prev.id;
      result[index] = {
        ...prev,
        company: next.company || prev.company,
        role: next.role || prev.role,
        url: next.url || prev.url,
        email: next.email || prev.email,
        providerId: next.providerId || prev.providerId,
        updatedAt: nowISO(),
      };
      updated++;
    }
  }
  return { contacts: result, added, updated, idMap };
}
export function recommendations(contacts, circles = [], now = Date.now()) {
  return contacts
    .filter(
      (c) => !c.archived && !c.needsReply && dateValue(c.snoozedUntil) <= now,
    )
    .map((c) => {
      const days = c.lastContactAt
        ? Math.floor((now - dateValue(c.lastContactAt)) / DAY)
        : null;
      if (days !== null && days < Math.min(7, c.cadence)) return null;
      const shared = circles.filter((g) => c.circleIds.includes(g.id));
      const overdue = days === null ? 0 : Math.max(0, days - c.cadence);
      const score =
        (days === null ? 30 : Math.min(55, (days / c.cadence) * 40)) +
        (c.memory ? 18 : 0) +
        (c.reason ? 12 : 0) +
        (c.favorite ? 12 : 0) +
        (shared.some((g) => g.memory) ? 8 : 0);
      const reason =
        c.reason ||
        (overdue > 0
          ? `It's been ${days} days since you caught up. Your rhythm is every ${c.cadence} days.`
          : c.memory
            ? "You have a shared memory to pick up from."
            : days === null
              ? "A first check-in could be a good place to start."
              : `Last caught up ${days} days ago. A short hello is enough.`);
      return {
        contact: c,
        score,
        reason,
        days,
        label:
          overdue > 0
            ? "Time to reconnect"
            : c.reason
              ? "A reason to say hi"
              : "Pick up the thread",
        shared,
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        b.score - a.score || a.contact.name.localeCompare(b.contact.name),
    );
}
export function fallbackDraft(contact, intent = "catch-up", variant = 0) {
  const first = contact.name.split(/\s+/)[0];
  const greeting = variant === 1 ? `Hey ${first}!` : `Hi ${first},`;
  const lines = {
    "catch-up": [
      "it's been a while! How have you been? Would be nice to catch up.",
      "how are things with you? I'd love to hear what you've been up to.",
    ],
    perspective: [
      "I've been thinking through my next career step and would love your take. Do you have time for a quick chat sometime?",
      "could I run a career question by you when you have a moment? I'd value your perspective.",
    ],
    "thank-you": [
      "I wanted to say thanks for your help. I really appreciated it. How have you been?",
      "I was thinking about how helpful you've been and wanted to say thank you. Hope things are going well.",
    ],
    reply: [
      "good to hear from you! I'd love to catch up. What does your week look like?",
      "thanks for getting back to me! When would be a good time to chat?",
    ],
  };
  return `${greeting} ${(lines[intent] || lines["catch-up"])[variant % 2]}`;
}
export function reminderCalendar(contact, when) {
  const stamp = (d) =>
    new Date(d).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const escape = (s) =>
    String(s)
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  if (!dateValue(when)) throw new Error("Choose a reminder date first.");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Relationship Copilot//EN",
    "BEGIN:VEVENT",
    `UID:${contact.id}-${dateValue(when)}@relationship-copilot`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(when)}`,
    `DTEND:${stamp(dateValue(when) + 15 * 60000)}`,
    `SUMMARY:${escape(`Catch up with ${contact.name}`)}`,
    `DESCRIPTION:${escape(contact.url || "Open Relationship Copilot to pick up the conversation.")}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT10M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Relationship reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
