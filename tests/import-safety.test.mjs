import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../server/node-db.mjs";
import { Store } from "../server/store.js";
import { api } from "../server/api.js";
import { parseBackup } from "../shared/import.js";

function request(body) {
  return new Request("https://app.test/api/import", {
    method: "POST",
    headers: { origin: "https://app.test", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("malformed backup messages cannot partially update contacts", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const contact = await store.saveContact("alice", {
      name: "Test Person",
      company: "Original",
      memory: "Keep this note",
    });
    const before = await store.snapshot("alice");
    const response = await api(
      request({
        contacts: [{ ...contact, company: "Should not be saved" }],
        messages: [{ contactId: { invalid: true }, text: "Hello" }],
      }),
      { DB: db },
      "alice",
    );
    assert.deepEqual(await store.snapshot("alice"), before);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Message 1.*contact/i);
  } finally {
    db.close();
  }
});

test("malformed collections and records are rejected before any import write", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const before = await store.snapshot("alice");
    const contact = { id: "new", name: "Test Person" };
    const invalid = [
      null,
      [],
      { contacts: [null] },
      { contacts: [{ name: "" }] },
      { contacts: [contact], circles: [null] },
      { contacts: [contact], circles: [{ name: "" }] },
      { contacts: [contact], messages: "not a list" },
      { contacts: [contact], messages: [null] },
      { contacts: [contact], messages: [{ contactId: "new", text: "" }] },
      {
        contacts: [contact],
        messages: [{ contactId: "new", text: "Hello", at: "invalid" }],
      },
      {
        contacts: [contact],
        messages: [{ contactId: "new", text: "Hello", direction: "unknown" }],
      },
      { contacts: [contact], settings: [] },
      { contacts: [contact], circles: Array(501).fill({ name: "Circle" }) },
      {
        contacts: [contact],
        messages: Array(10001).fill({ contactId: "new", text: "Hello" }),
      },
    ];
    for (const body of invalid) {
      const response = await api(request(body), { DB: db }, "alice");
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /Nothing was imported/);
      assert.deepEqual(await store.snapshot("alice"), before);
    }
  } finally {
    db.close();
  }
});

test("backup preview rejects bad message and circle records rather than silently dropping them", () => {
  for (const data of [
    { contacts: [null] },
    { contacts: [], circles: "lost circles" },
    { contacts: [], messages: [{ contactId: {}, text: "Hello" }] },
    { contacts: [], messages: null },
  ])
    assert.throws(
      () => parseBackup(JSON.stringify(data)),
      /Nothing was imported/,
    );
});

test("a storage failure rolls back contacts, circles, messages AND the import receipt", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const contact = await store.saveContact("alice", {
      name: "Test Person",
      company: "Original",
    });
    await store.settings("alice", {
      name: "Test Owner",
      lastImportedAt: "original-receipt",
    });
    const before = await store.snapshot("alice");
    let batches = 0;
    const failingDB = {
      ...db,
      batch(statements) {
        batches++;
        return db.batch([
          ...statements,
          db.prepare("INSERT INTO nonexistent_table VALUES (?)").bind("fail"),
        ]);
      },
    };
    const response = await api(
      request({
        contacts: [{ ...contact, company: "Changed" }],
        circles: [{ id: "circle", name: "Test teammates" }],
        messages: [{ id: "message", contactId: contact.id, text: "Hello" }],
        settings: { name: "Changed Owner" },
      }),
      { DB: failingDB },
      "alice",
    );
    assert.equal(response.status, 500);
    assert.equal(batches, 1);
    assert.deepEqual(await store.snapshot("alice"), before);
  } finally {
    db.close();
  }
});

test("atomic restore remaps message identities, preserves existing relationships and supports retry", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const original = await store.saveContact("alice", {
      name: "Test Person",
      company: "Before",
      email: "test@example.com",
      memory: "Keep this",
      draft: "Hi Test",
      circleIds: ["circle"],
      needsReply: true,
    });
    await store.saveCircle("alice", {
      id: "circle",
      name: "Original circle",
      memory: "Original memory",
    });
    await store.settings("alice", { name: "Before", notifications: true });
    const payload = {
      contacts: [
        {
          id: "backup-person",
          name: "Test Person",
          company: "After",
          email: "test@example.com",
        },
      ],
      circles: [
        { id: "circle", name: "Changed circle" },
        { id: "new-circle", name: "New circle" },
      ],
      messages: [
        {
          id: "m",
          contactId: "backup-person",
          text: "Historical outgoing",
          direction: "out",
          at: "2025-01-01T12:00:00Z",
        },
      ],
      settings: {
        name: "Restored",
        voice: "Brief",
        weeklyGoal: 5,
        notifications: false,
      },
    };
    for (let n = 0; n < 2; n++) {
      const result = await store.import("alice", payload);
      assert.equal(result.updated, 1);
      assert.equal(result.idMap["backup-person"], original.id);
    }
    const after = await store.snapshot("alice");
    assert.equal(after.contacts.length, 1);
    assert.equal(after.contacts[0].company, "After");
    for (const key of [
      "memory",
      "draft",
      "circleIds",
      "needsReply",
      "lastContactAt",
    ])
      assert.deepEqual(after.contacts[0][key], original[key]);
    assert.equal(after.circles.length, 2);
    assert.equal(
      after.circles.find((c) => c.id === "circle").name,
      "Original circle",
    );
    assert.equal(after.messages.length, 1);
    assert.equal(after.messages[0].contactId, original.id);
    assert.equal(after.settings.name, "Restored");
    assert.equal(after.settings.notifications, true);
    assert.equal(after.settings.lastImportCount, 1);
    assert.ok(after.settings.lastImportedAt);
    assert.equal((await store.snapshot("bob")).contacts.length, 0);
    assert.equal((await store.snapshot("bob")).messages.length, 0);
  } finally {
    db.close();
  }
});

test("orphan messages, including another owner's contact, reject the entire import", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const other = await store.saveContact("bob", {
      name: "Other Owner's Person",
    });
    const before = await store.snapshot("alice");
    const response = await api(
      request({
        contacts: [{ name: "New Person" }],
        messages: [{ contactId: other.id, text: "Hello" }],
      }),
      { DB: db },
      "alice",
    );
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Message 1.*missing/);
    assert.deepEqual(await store.snapshot("alice"), before);
  } finally {
    db.close();
  }
});

test("10,000 contacts fit in one atomic batch with bounded UTF-8 parameters", async () => {
  const db = openDatabase(":memory:");
  try {
    let batches = 0,
      queryCount = 0;
    const checked = {
      ...db,
      prepare(sql) {
        queryCount++;
        assert.ok(Buffer.byteLength(sql) < 100000);
        return {
          bind(...args) {
            assert.ok(args.length <= 100);
            for (const arg of args)
              if (typeof arg === "string")
                assert.ok(Buffer.byteLength(arg) <= 512 * 1024);
            return db.prepare(sql).bind(...args);
          },
        };
      },
      batch(statements) {
        batches++;
        return db.batch(statements);
      },
    };
    const store = new Store(checked);
    const result = await store.import("alice", {
      contacts: Array.from({ length: 10000 }, (_, n) => ({
        id: `person-${n}`,
        name: `Test Person ${n}`,
        memory: "\u4f60\u597d".repeat(20),
      })),
    });
    assert.equal(result.added, 10000);
    assert.equal(batches, 1);
    assert.ok(queryCount <= 50);
    assert.equal((await store.list("contacts", "alice")).length, 10000);
  } finally {
    db.close();
  }
});
