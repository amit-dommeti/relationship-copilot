import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../server/node-db.mjs";
import { Store } from "../server/store.js";
import { api } from "../server/api.js";

const requestId = "b1884cab-359a-4c13-bc1e-f983a15c7df9";
const messageRequest = (contactId, body) =>
  new Request(`https://app.test/api/contacts/${contactId}/messages`, {
    method: "POST",
    headers: { origin: "https://app.test", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

test("retrying a recorded message returns the original record without duplicate history", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const person = await store.saveContact("alice", { name: "Test Person" });
    const body = {
      requestId,
      text: "A reply with a lost confirmation",
      direction: "in",
    };
    const first = await api(
      messageRequest(person.id, body),
      { DB: db },
      "alice",
    );
    assert.equal(first.status, 201);
    const original = await first.json();
    const before = await store.snapshot("alice");
    const retry = await api(
      messageRequest(person.id, body),
      { DB: db },
      "alice",
    );
    assert.equal(retry.status, 201);
    assert.equal((await store.list("messages", "alice")).length, 1);
    assert.deepEqual(await retry.json(), original);
    assert.deepEqual(await store.snapshot("alice"), before);
  } finally {
    db.close();
  }
});

test("replaying outgoing history preserves later reminders, drafts and reply state", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const person = await store.saveContact("alice", { name: "Test Person" });
    const body = { requestId, text: "Previously sent", direction: "out" };
    await api(messageRequest(person.id, body), { DB: db }, "alice");
    const current = await store.contact("alice", person.id);
    await store.saveContact("alice", {
      ...current,
      needsReply: true,
      draft: "A newer draft",
      reminderAt: "2027-12-01T12:00:00Z",
      snoozedUntil: "2027-11-01T12:00:00Z",
    });
    const before = await store.snapshot("alice");
    assert.equal(
      (await api(messageRequest(person.id, body), { DB: db }, "alice")).status,
      201,
    );
    assert.deepEqual(await store.snapshot("alice"), before);
  } finally {
    db.close();
  }
});

test("one identity cannot silently record different content, direction or person", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const one = await store.saveContact("alice", { name: "One" });
    const two = await store.saveContact("alice", { name: "Two" });
    const body = { requestId, text: "Original", direction: "in" };
    await api(messageRequest(one.id, body), { DB: db }, "alice");
    const before = await store.snapshot("alice");
    for (const [id, changed] of [
      [one.id, { ...body, text: "Changed" }],
      [one.id, { ...body, direction: "out" }],
      [two.id, body],
    ]) {
      const response = await api(
        messageRequest(id, changed),
        { DB: db },
        "alice",
      );
      assert.equal(response.status, 409);
      assert.match((await response.json()).error, /different message/);
      assert.deepEqual(await store.snapshot("alice"), before);
    }
  } finally {
    db.close();
  }
});

test("simultaneous matching retries share one record and conflicting retries reject", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const person = await store.saveContact("alice", { name: "Test Person" });
    const body = { requestId, text: "One message", direction: "out" };
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        api(messageRequest(person.id, body), { DB: db }, "alice"),
      ),
    );
    const records = await Promise.all(responses.map((r) => r.json()));
    assert.ok(responses.every((r) => r.status === 201));
    assert.ok(
      records.every((r) => JSON.stringify(r) === JSON.stringify(records[0])),
    );
    assert.equal((await store.list("messages", "alice")).length, 1);
    const nextId = "d2dd45a2-293f-4722-a305-bb076967384d";
    const conflicts = await Promise.all(
      ["First", "Second"].map((text) =>
        api(
          messageRequest(person.id, { ...body, requestId: nextId, text }),
          { DB: db },
          "alice",
        ),
      ),
    );
    assert.deepEqual(conflicts.map((r) => r.status).sort(), [201, 409]);
    assert.equal((await store.list("messages", "alice")).length, 2);
  } finally {
    db.close();
  }
});

test("message-save identities are validated, owner-scoped, and optional for old clients", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const one = await store.saveContact("alice", {
      id: "same-person",
      name: "Alice's Person",
    });
    await store.saveContact("bob", { id: "same-person", name: "Bob's Person" });
    for (const bad of [null, "", "not-a-uuid", {}, "a".repeat(1000)]) {
      assert.equal(
        (
          await api(
            messageRequest(one.id, { requestId: bad, text: "Hello" }),
            { DB: db },
            "alice",
          )
        ).status,
        400,
      );
    }
    assert.equal((await store.list("messages", "alice")).length, 0);
    for (const owner of ["alice", "bob"]) {
      assert.equal(
        (
          await api(
            messageRequest(one.id, { requestId, text: owner }),
            { DB: db },
            owner,
          )
        ).status,
        201,
      );
      assert.equal((await store.list("messages", owner))[0].text, owner);
    }
    for (let i = 0; i < 2; i++)
      assert.equal(
        (
          await api(
            messageRequest(one.id, { text: "No supplied identity" }),
            { DB: db },
            "alice",
          )
        ).status,
        201,
      );
    assert.equal((await store.list("messages", "alice")).length, 3);
  } finally {
    db.close();
  }
});

test("a failed message insert rolls back the preceding contact-state update", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const person = await store.saveContact("alice", {
      name: "Test Person",
      draft: "Keep my draft",
      needsReply: true,
    });
    const before = await store.snapshot("alice");
    const failingDB = {
      ...db,
      batch(statements) {
        return db.batch([
          statements[0],
          db.prepare("INSERT INTO missing_table VALUES (?)").bind("fail"),
          ...statements.slice(1),
        ]);
      },
    };
    const body = { requestId, text: "Outgoing", direction: "out" };
    assert.equal(
      (await api(messageRequest(person.id, body), { DB: failingDB }, "alice"))
        .status,
      500,
    );
    assert.deepEqual(await store.snapshot("alice"), before);
    assert.equal(
      (await api(messageRequest(person.id, body), { DB: db }, "alice")).status,
      201,
    );
    assert.equal((await store.list("messages", "alice")).length, 1);
  } finally {
    db.close();
  }
});
