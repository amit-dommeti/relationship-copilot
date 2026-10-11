import {
  nowISO,
  normalizeContact,
  mergeContacts,
  normalizeCircle,
  text,
  uid,
  dateValue,
} from "../shared/domain.js";
import { validateImport, importError } from "../shared/import-validation.js";

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
    const c = normalizeContact(raw);
    await this.contactStatement(owner, c).run();
    return c;
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
    const {
      contacts: incoming,
      circles = [],
      messages = [],
      settings,
    } = validateImport(payload);
    const existing = await this.list("contacts", owner);
    const result = mergeContacts(existing, incoming);
    const previous = new Map(existing.map((c) => [c.id, JSON.stringify(c)]));
    const changed = result.contacts.filter(
      (c) => previous.get(c.id) !== JSON.stringify(c),
    );
    const contactIds = new Set(result.contacts.map((c) => c.id));
    const importedMessages = messages.map((m, index) => {
      const contactId = result.idMap[m.contactId] || m.contactId;
      if (!contactIds.has(contactId))
        throw importError(
          `Message ${index + 1} refers to a contact missing from this workspace and backup.`,
        );
      return {
        id: text(m.id, 1000) || uid(),
        contactId,
        text: text(m.text, 12000),
        direction: m.direction === "out" ? "out" : "in",
        at: dateValue(m.at) ? new Date(m.at).toISOString() : nowISO(),
        source: m.source === "linkedin" ? "linkedin" : "manual",
      };
    });
    const currentSettings = await this.settings(owner);
    const restored = settings
      ? {
          name: text(settings.name, 80),
          voice: text(settings.voice, 4000),
          weeklyGoal: Math.max(
            1,
            Math.min(20, Number(settings.weeklyGoal) || 3),
          ),
        }
      : {};
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
      ...jsonChunks(circles.map(normalizeCircle)).map((chunk) =>
        this.stmt(
          "INSERT INTO circles(owner,id,data) SELECT ?,json_extract(value,'$.id'),value FROM json_each(?) WHERE true ON CONFLICT(owner,id) DO NOTHING",
          owner,
          chunk,
        ),
      ),
      ...jsonChunks(importedMessages).map((chunk) =>
        this.stmt(
          "INSERT INTO messages(owner,id,contact_id,data,created_at) SELECT ?,json_extract(value,'$.id'),json_extract(value,'$.contactId'),value,json_extract(value,'$.at') FROM json_each(?) WHERE true ON CONFLICT(owner,id) DO NOTHING",
          owner,
          chunk,
        ),
      ),
      this.stmt(
        "INSERT INTO settings(owner,data) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET data=excluded.data",
        owner,
        JSON.stringify({
          ...currentSettings,
          ...restored,
          lastImportedAt: nowISO(),
          lastImportCount: incoming.length,
        }),
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
      m.direction === "out"
        ? ", '$.lastContactAt', ?, '$.reminderAt', '', '$.draft', ''"
        : "";
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
