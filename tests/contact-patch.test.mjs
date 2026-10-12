import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../server/node-db.mjs";
import { Store } from "../server/store.js";
import { api } from "../server/api.js";

const patch = (db, id, body, owner = "alice") =>
  api(
    new Request(`https://app.test/api/contacts/${id}`, {
      method: "PATCH",
      headers: {
        origin: "https://app.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    { DB: db },
    owner,
  );

// Pause after reading, so tests control the interleaving without timer races.
function afterContactRead(db, callback) {
  return {
    ...db,
    prepare(sql) {
      const prepared = db.prepare(sql);
      return {
        bind(...args) {
          const statement = prepared.bind(...args);
          return {
            ...statement,
            async first() {
              const row = await statement.first();
              if (
                sql === "SELECT data FROM contacts WHERE owner = ? AND id = ?"
              )
                await callback();
              return row;
            },
          };
        },
      };
    },
  };
}

test("overlapping contact patches preserve unrelated fields", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const person = await store.saveContact("alice", {
      name: "Synthetic Person",
      memory: "Original memory",
      draft: "Hi, keep this.",
    });
    let reads = 0,
      release;
    const bothRead = new Promise((resolve) => {
      release = resolve;
    });
    const overlappingDB = afterContactRead(db, async () => {
      if (++reads > 2) return;
      if (reads === 2) release();
      await bothRead;
    });
    const responses = await Promise.all([
      patch(overlappingDB, person.id, { memory: "New shared history" }),
      patch(overlappingDB, person.id, { reminderAt: "2027-12-01T12:00:00Z" }),
    ]);
    assert.deepEqual(
      responses.map((r) => r.status),
      [200, 200],
    );
    const current = await store.contact("alice", person.id);
    assert.equal(current.memory, "New shared history");
    assert.equal(current.reminderAt, "2027-12-01T12:00:00.000Z");
    assert.equal(current.draft, person.draft);
    assert.notEqual(current.draftVersion, person.draftVersion);
  } finally {
    db.close();
  }
});

test("a paused metadata patch cannot undo a newly recorded reply", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const person = await store.saveContact("alice", {
      name: "Synthetic Person",
    });
    let injected = false;
    const delayedDB = afterContactRead(db, async () => {
      if (injected) return;
      injected = true;
      await store.message("alice", person, {
        id: "new-reply",
        direction: "in",
        text: "Hi, great to hear from you.",
        at: "2027-12-01T12:00:00Z",
      });
    });
    assert.equal(
      (await patch(delayedDB, person.id, { company: "New company" })).status,
      200,
    );
    const current = await store.contact("alice", person.id);
    assert.equal(current.company, "New company");
    assert.equal(current.needsReply, true);
    assert.equal(current.latestMessageAt, "2027-12-01T12:00:00.000Z");
    assert.equal((await store.list("messages", "alice")).length, 1);
  } finally {
    db.close();
  }
});

test("the optional stale-write guard is checked at the write, not the initial read", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const person = await store.saveContact("alice", {
      name: "Synthetic Person",
    });
    let injected = false;
    const delayedDB = afterContactRead(db, async () => {
      if (injected) return;
      injected = true;
      await store
        .stmt(
          "UPDATE contacts SET data=json_set(data,'$.memory',?,'$.updatedAt',?),updated_at=? WHERE owner=? AND id=?",
          "Saved elsewhere",
          "2027-12-01T00:00:00.000Z",
          "2027-12-01T00:00:00.000Z",
          "alice",
          person.id,
        )
        .run();
    });
    const response = await patch(delayedDB, person.id, {
      memory: "Stale edit",
      expectedUpdatedAt: person.updatedAt,
    });
    assert.equal(response.status, 409);
    assert.equal(
      (await store.contact("alice", person.id)).memory,
      "Saved elsewhere",
    );
  } finally {
    db.close();
  }
});

test("patches normalize submitted values, allow clearing, and protect identity and provenance", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const person = await store.saveContact("alice", {
      name: "Synthetic Person",
      circleIds: ["circle-a"],
      memory: "Remember this",
      draft: "Hi there",
      favorite: true,
      needsReply: true,
      source: "import",
      providerId: "provider",
      chatId: "chat",
      createdAt: "2020-01-01T00:00:00Z",
    });
    const response = await patch(db, person.id, {
      company: "  Updated company  ",
      circleIds: [],
      memory: "",
      draft: "",
      favorite: false,
      needsReply: false,
      cadence: 9999,
      id: "replacement",
      source: "linkedin",
      providerId: "replacement",
      chatId: "replacement",
      createdAt: "2027-01-01T00:00:00Z",
      updatedAt: "forged",
      draftVersion: "forged",
    });
    assert.equal(response.status, 200);
    const current = await response.json();
    for (const key of [
      "id",
      "name",
      "source",
      "providerId",
      "chatId",
      "createdAt",
    ])
      assert.equal(current[key], person[key]);
    assert.equal(current.company, "Updated company");
    assert.deepEqual(current.circleIds, []);
    assert.equal(current.memory, "");
    assert.equal(current.draft, "");
    assert.equal(current.favorite, false);
    assert.equal(current.needsReply, false);
    assert.equal(current.cadence, 365);
    assert.notEqual(current.draftVersion, person.draftVersion);
    assert.notEqual(current.draftVersion, "forged");
    assert.notEqual(current.updatedAt, "forged");
    assert.deepEqual(await store.contact("alice", person.id), current);
    assert.equal(await store.contact("alice", "replacement"), null);
  } finally {
    db.close();
  }
});

test("invalid patches return a useful error without changing saved work", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const person = await store.saveContact("alice", {
      name: "Synthetic Person",
    });
    for (const body of [
      null,
      [],
      "not an object",
      { name: " " },
      { expectedUpdatedAt: {} },
    ]) {
      assert.equal((await patch(db, person.id, body)).status, 400);
      assert.deepEqual(await store.contact("alice", person.id), person);
    }
    assert.equal(
      (await patch(db, person.id, { memory: "Wrong owner" }, "bob")).status,
      404,
    );
    assert.deepEqual(await store.contact("alice", person.id), person);
  } finally {
    db.close();
  }
});

test("a contact deleted after the read is not recreated by a delayed patch", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const person = await store.saveContact("alice", {
      name: "Synthetic Person",
    });
    let injected = false;
    const delayedDB = afterContactRead(db, async () => {
      if (injected) return;
      injected = true;
      await store
        .stmt("DELETE FROM contacts WHERE owner=? AND id=?", "alice", person.id)
        .run();
    });
    assert.equal(
      (await patch(delayedDB, person.id, { memory: "Stale edit" })).status,
      404,
    );
    assert.equal(await store.contact("alice", person.id), null);
  } finally {
    db.close();
  }
});

test("matching timestamp guards succeed and stale guards leave the contact unchanged", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const person = await store.saveContact("alice", {
      name: "Synthetic Person",
    });
    assert.equal(
      (
        await patch(db, person.id, {
          memory: "Saved with a valid guard",
          expectedUpdatedAt: person.updatedAt,
        })
      ).status,
      200,
    );
    const saved = await store.contact("alice", person.id);
    assert.equal(saved.memory, "Saved with a valid guard");
    assert.equal(
      (
        await patch(db, person.id, {
          memory: "Rejected",
          expectedUpdatedAt: "2020-01-01T00:00:00Z",
        })
      ).status,
      409,
    );
    assert.deepEqual(await store.contact("alice", person.id), saved);
  } finally {
    db.close();
  }
});

test("a failed patch leaves every saved field and its draft version unchanged", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const person = await store.saveContact("alice", {
      name: "Synthetic Person",
      draft: "Hi, keep this.",
    });
    const failingDB = {
      ...db,
      prepare(sql) {
        return {
          bind(...args) {
            const statement = db.prepare(sql).bind(...args);
            return {
              ...statement,
              async first() {
                if (sql.startsWith("UPDATE contacts"))
                  throw new Error("Synthetic write failure");
                return statement.first();
              },
              async run() {
                throw new Error("Synthetic write failure");
              },
            };
          },
        };
      },
    };
    assert.equal(
      (await patch(failingDB, person.id, { draft: "", memory: "New note" }))
        .status,
      500,
    );
    assert.deepEqual(await store.contact("alice", person.id), person);
  } finally {
    db.close();
  }
});

test("a save acknowledges its own draft version, never a later identical-text save", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const person = await store.saveContact("alice", {
      name: "Synthetic Person",
      draft: "Hi, same text.",
    });
    let later;
    const afterWrite = async (sql) => {
      if (later || !sql.startsWith("UPDATE contacts")) return;
      later = await store.saveContact("alice", {
        ...(await store.contact("alice", person.id)),
        draft: person.draft,
      });
    };
    const interleavedDB = {
      ...db,
      prepare(sql) {
        return {
          bind(...args) {
            const statement = db.prepare(sql).bind(...args);
            return {
              ...statement,
              async first() {
                const row = await statement.first();
                await afterWrite(sql);
                return row;
              },
              async run() {
                const result = await statement.run();
                await afterWrite(sql);
                return result;
              },
            };
          },
        };
      },
    };
    const response = await patch(interleavedDB, person.id, {
      draft: person.draft,
    });
    assert.equal(response.status, 200);
    const acknowledged = await response.json();
    assert.ok(later);
    assert.notEqual(acknowledged.draftVersion, later.draftVersion);
    await store.message("alice", acknowledged, {
      text: acknowledged.draft,
      direction: "out",
      expectedDraftVersion: acknowledged.draftVersion,
    });
    const current = await store.contact("alice", person.id);
    assert.equal(current.draft, later.draft);
    assert.equal(current.draftVersion, later.draftVersion);
  } finally {
    db.close();
  }
});
