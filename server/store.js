import {
  nowISO,
  normalizeContact,
  normalizeCircle,
  text,
  uid,
  dateValue,
} from "../shared/domain.js";
import { validateImport, importError } from "../shared/import-validation.js";
import { prepareWorkspaceImport } from "../shared/import-plan.js";

const contactFields = [
  "name",
  "company",
  "role",
  "url",
  "email",
  "relationship",
  "circleIds",
  "memory",
  "reason",
  "cadence",
  "lastContactAt",
  "connectedAt",
  "snoozedUntil",
  "reminderAt",
  "needsReply",
  "archived",
  "favorite",
  "draft",
  "latestMessageAt",
];

function jsonChunks(records) {
  const chunks = [];
  let rows = [],
    bytes = 2;
  const encoder = new TextEncoder();
  for (const record of records) {
    const json = JSON.stringify(record);
    const size = encoder.encode(json).length + 1;
    if (bytes + size > 512 * 1024 && rows.length) {
      chunks.push(`[${rows.join(",")}]`);
      rows = [];
      bytes = 2;
    }
    rows.push(json);
    bytes += size;
  }
  if (rows.length) chunks.push(`[${rows.join(",")}]`);
  return chunks;
}

export class Store {
  constructor(db) {
    this.db = db;
  }
  stmt(sql, ...args) {
    return this.db.prepare(sql).bind(...args);
  }
  async list(table, owner) {
    if (!["contacts", "circles", "messages"].includes(table))
      throw new Error("Unknown collection");
    return (
      await this.stmt(`SELECT data FROM ${table} WHERE owner = ?`, owner).all()
    ).results.map((r) => JSON.parse(r.data));
  }
  async contact(owner, id) {
    const row = await this.stmt(
      "SELECT data FROM contacts WHERE owner = ? AND id = ?",
      owner,
      id,
    ).first();
    return row ? JSON.parse(row.data) : null;
  }
  contactStatement(owner, c) {
    return this.stmt(
      "INSERT INTO contacts(owner,id,data,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
      owner,
      c.id,
      JSON.stringify(c),
      c.updatedAt,
    );
  }
  async saveContact(owner, raw) {
    // A fresh token makes even identical-text saves distinguishable. Any contact
    // save conservatively invalidates an older action's permission to clear.
    const c = { ...normalizeContact(raw), draftVersion: uid() };
    await this.contactStatement(owner, c).run();
    return c;
  }
  async patchContact(owner, contact, raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw Object.assign(new Error("Send the contact fields to update."), {
        status: 400,
      });
    const expected = raw.expectedUpdatedAt;
    if (
      expected !== undefined &&
      (typeof expected !== "string" || !expected || expected.length > 50)
    )
      throw Object.assign(
        new Error("The contact version is invalid. Reload before saving."),
        { status: 400 },
      );
    const fields = contactFields.filter((key) => Object.hasOwn(raw, key));
    let normalized;
    try {
      normalized = normalizeContact({
        name: contact.name,
        ...Object.fromEntries(fields.map((key) => [key, raw[key]])),
      });
    } catch (error) {
      throw Object.assign(error, { status: 400 });
    }
    const changes = {
      ...Object.fromEntries(fields.map((key) => [key, normalized[key]])),
      draftVersion: uid(),
      updatedAt: normalized.updatedAt,
    };
    // Merge at the write, not into the earlier read: unrelated edits and new
    // message state must survive. A deleted contact must never be recreated.
    // RETURNING acknowledges this write's token, never a later writer's token.
    const row = await this.stmt(
      `UPDATE contacts SET data=json_patch(data,?),updated_at=? WHERE owner=? AND id=?${expected === undefined ? "" : " AND json_extract(data,'$.updatedAt')=?"} RETURNING data`,
      JSON.stringify(changes),
      changes.updatedAt,
      owner,
      contact.id,
      ...(expected === undefined ? [] : [expected]),
    ).first();
    if (row) return JSON.parse(row.data);
    if (!(await this.contact(owner, contact.id)))
      throw Object.assign(new Error("Contact not found."), { status: 404 });
    throw Object.assign(
      new Error(
        "This contact changed in another window. Reload before saving.",
      ),
      { status: 409 },
    );
  }
  async saveCircle(owner, raw) {
    const c = normalizeCircle(raw);
    await this.stmt(
      "INSERT INTO circles(owner,id,data) VALUES(?,?,?) ON CONFLICT(owner,id) DO UPDATE SET data=excluded.data",
      owner,
      c.id,
      JSON.stringify(c),
    ).run();
    return c;
  }
  async import(owner, payload) {
    validateImport(payload);
    const existing = await this.list("contacts", owner);
    const currentSettings = await this.settings(owner);
    const result = prepareWorkspaceImport(existing, currentSettings, payload);
    const previous = new Map(existing.map((c) => [c.id, JSON.stringify(c)]));
    const changed = result.contacts.filter(
      (c) => previous.get(c.id) !== JSON.stringify(c),
    );
    // Bounded JSON parameters keep large imports below D1's query/parameter limits.
    // Every table and the import receipt commit together in ONE transactional batch.
    const statements = [
      ...jsonChunks(changed).map((chunk) =>
        this.stmt(
          "INSERT INTO contacts(owner,id,data,updated_at) SELECT ?,json_extract(value,'$.id'),value,json_extract(value,'$.updatedAt') FROM json_each(?) WHERE true ON CONFLICT(owner,id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
          owner,
          chunk,
        ),
      ),
      ...jsonChunks(result.circles).map((chunk) =>
        this.stmt(
          "INSERT INTO circles(owner,id,data) SELECT ?,json_extract(value,'$.id'),value FROM json_each(?) WHERE true ON CONFLICT(owner,id) DO NOTHING",
          owner,
          chunk,
        ),
      ),
      ...jsonChunks(result.messages).map((chunk) =>
        this.stmt(
          "INSERT INTO messages(owner,id,contact_id,data,created_at) SELECT ?,json_extract(value,'$.id'),json_extract(value,'$.contactId'),value,json_extract(value,'$.at') FROM json_each(?) WHERE true ON CONFLICT(owner,id) DO NOTHING",
          owner,
          chunk,
        ),
      ),
      this.stmt(
        "INSERT INTO settings(owner,data) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET data=excluded.data",
        owner,
        JSON.stringify(result.settings),
      ),
    ];
    if (statements.length > 45)
      throw importError(
        "This backup is too large for one safe import. Use a smaller file.",
      );
    await this.db.batch(statements);
    return {
      added: result.added,
      updated: result.updated,
      idMap: result.idMap,
    };
  }
  async settings(owner, value) {
    if (value)
      await this.stmt(
        "INSERT INTO settings(owner,data) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET data=excluded.data",
        owner,
        JSON.stringify(value),
      ).run();
    const row = await this.stmt(
      "SELECT data FROM settings WHERE owner=?",
      owner,
    ).first();
    return row
      ? JSON.parse(row.data)
      : { name: "", weeklyGoal: 3, voice: "", notifications: false };
  }
  async message(owner, contact, raw, updateState = true) {
    const at = dateValue(raw.at) ? new Date(raw.at).toISOString() : nowISO();
    const m = {
      id: text(raw.id, 1000) || uid(),
      contactId: contact.id,
      text: text(raw.text, 12000),
      direction: raw.direction === "out" ? "out" : "in",
      at,
      source: raw.source === "linkedin" ? "linkedin" : "manual",
    };
    // The guarded update and insert share a transaction. Replays cannot reset
    // newer reply state, reminders or drafts, even when requests arrive together.
    const now = nowISO();
    const fields =
      m.direction === "out" ? ", '$.lastContactAt', ?, '$.reminderAt', ''" : "";
    const statements = [
      ...(updateState
        ? [
            this.stmt(
              `UPDATE contacts SET data=json_set(data, '$.needsReply', json(?), '$.latestMessageAt', ?, '$.snoozedUntil', '', '$.updatedAt', ? ${fields}), updated_at=? WHERE owner=? AND id=? AND COALESCE(json_extract(data,'$.latestMessageAt'),'') <= ? AND COALESCE(json_extract(data,'$.lastContactAt'),'') <= ? AND NOT EXISTS (SELECT 1 FROM messages WHERE owner=? AND id=?)`,
              m.direction === "in" ? "true" : "false",
              at,
              now,
              ...(m.direction === "out" ? [at] : []),
              now,
              owner,
              contact.id,
              at,
              at,
              owner,
              m.id,
            ),
          ]
        : []),
      ...(updateState &&
      m.direction === "out" &&
      typeof raw.expectedDraftVersion === "string"
        ? [
            this.stmt(
              "UPDATE contacts SET data=json_set(data, '$.draft', '', '$.draftVersion', ?) WHERE owner=? AND id=? AND COALESCE(json_extract(data,'$.draftVersion'),'')=? AND json_extract(data,'$.draft')=? AND COALESCE(json_extract(data,'$.latestMessageAt'),'') <= ? AND COALESCE(json_extract(data,'$.lastContactAt'),'') <= ? AND NOT EXISTS (SELECT 1 FROM messages WHERE owner=? AND id=?)",
              uid(),
              owner,
              contact.id,
              raw.expectedDraftVersion,
              m.text,
              at,
              at,
              owner,
              m.id,
            ),
          ]
        : []),
      this.stmt(
        "INSERT INTO messages(owner,id,contact_id,data,created_at) VALUES(?,?,?,?,?) ON CONFLICT(owner,id) DO NOTHING",
        owner,
        m.id,
        contact.id,
        JSON.stringify(m),
        at,
      ),
    ];
    await this.db.batch(statements);
    const row = await this.stmt(
      "SELECT data FROM messages WHERE owner=? AND id=?",
      owner,
      m.id,
    ).first();
    const saved = JSON.parse(row.data);
    if (
      ["contactId", "text", "direction", "source"].some(
        (field) => saved[field] !== m[field],
      ) ||
      (dateValue(raw.at) && saved.at !== m.at)
    )
      throw Object.assign(
        new Error(
          "This save identity already belongs to a different message. Your saved history was not changed.",
        ),
        { status: 409 },
      );
    return saved;
  }
  async snapshot(owner) {
    const [contacts, circles, messages, settings] = await Promise.all([
      this.list("contacts", owner),
      this.list("circles", owner),
      this.list("messages", owner),
      this.settings(owner),
    ]);
    return {
      contacts,
      circles,
      messages: messages.sort((a, b) => dateValue(a.at) - dateValue(b.at)),
      settings,
      connection: null,
    };
  }
}
