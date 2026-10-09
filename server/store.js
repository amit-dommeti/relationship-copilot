import {
  nowISO,
  normalizeContact,
  mergeContacts,
  normalizeCircle,
  text,
  uid,
  dateValue,
} from "../shared/domain.js";

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
  async import(owner, incoming, circles = []) {
    const existing = await this.list("contacts", owner);
    const result = mergeContacts(existing, incoming);
    const changed = result.contacts.filter(
      (c) =>
        !existing.some(
          (p) => p.id === c.id && JSON.stringify(p) === JSON.stringify(c),
        ),
    );
    for (let i = 0; i < changed.length; i += 50)
      await this.db.batch(
        changed.slice(i, i + 50).map((c) => this.contactStatement(owner, c)),
      );
    const previousCircles = await this.list("circles", owner);
    for (const c of circles)
      if (!previousCircles.some((g) => g.id === c.id))
        await this.saveCircle(owner, c);
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
    const old = await this.stmt(
      "SELECT id FROM messages WHERE owner=? AND id=?",
      owner,
      m.id,
    ).first();
    if (old) return m;
    // Update the current row, not a stale copy captured before another message arrived.
    const now = nowISO();
    const fields =
      m.direction === "out"
        ? ", '$.lastContactAt', ?, '$.reminderAt', '', '$.draft', ''"
        : "";
    const statements = [
      this.stmt(
        "INSERT OR IGNORE INTO messages(owner,id,contact_id,data,created_at) VALUES(?,?,?,?,?)",
        owner,
        m.id,
        contact.id,
        JSON.stringify(m),
        at,
      ),
      this.stmt(
        `UPDATE contacts SET data=json_set(data, '$.needsReply', json(?), '$.latestMessageAt', ?, '$.snoozedUntil', '', '$.updatedAt', ? ${fields}), updated_at=? WHERE owner=? AND id=? AND COALESCE(json_extract(data,'$.latestMessageAt'),'') <= ? AND COALESCE(json_extract(data,'$.lastContactAt'),'') <= ?`,
        m.direction === "in" ? "true" : "false",
        at,
        now,
        ...(m.direction === "out" ? [at] : []),
        now,
        owner,
        contact.id,
        at,
        at,
      ),
    ];
    await this.db.batch(updateState ? statements : statements.slice(0, 1));
    return m;
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
