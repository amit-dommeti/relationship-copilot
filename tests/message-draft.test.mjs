import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../server/node-db.mjs";
import { Store } from "../server/store.js";
import { api } from "../server/api.js";

const request = (id, body) =>
  new Request(`https://app.test/api/contacts/${id}/messages`, {
    method: "POST",
    headers: { origin: "https://app.test", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

test("recording conversation history never clears a saved composer draft by default", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    for (const direction of ["in", "out"]) {
      const person = await store.saveContact("alice", {
        name: "Synthetic Person",
        draft: "Hi, keep this.",
      });
      const response = await api(
        request(person.id, { text: person.draft, direction }),
        { DB: db },
        "alice",
      );
      assert.equal(response.status, 201);
      assert.equal(
        (await store.contact("alice", person.id)).draft,
        person.draft,
      );
    }
  } finally {
    db.close();
  }
});

test("only an explicitly matched saved draft is cleared, atomically with its outgoing record", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const person = await store.saveContact("alice", {
      name: "Synthetic Person",
      draft: "Hi, this was sent.",
      needsReply: true,
    });
    const body = {
      text: person.draft,
      direction: "out",
      expectedDraftVersion: person.draftVersion,
    };
    const failingDB = {
      ...db,
      batch(statements) {
        return db.batch([
          ...statements.slice(0, -1),
          db.prepare("INSERT INTO missing_table VALUES (?)").bind("fail"),
          statements.at(-1),
        ]);
      },
    };
    const before = await store.snapshot("alice");
    assert.equal(
      (await api(request(person.id, body), { DB: failingDB }, "alice")).status,
      500,
    );
    assert.deepEqual(await store.snapshot("alice"), before);
    assert.equal(
      (await api(request(person.id, body), { DB: db }, "alice")).status,
      201,
    );
    const saved = await store.contact("alice", person.id);
    assert.equal(saved.draft, "");
    assert.notEqual(saved.draftVersion, person.draftVersion);
    assert.equal(saved.needsReply, false);
    assert.equal((await store.list("messages", "alice")).length, 1);
  } finally {
    db.close();
  }
});

test("a delayed message cannot clear a newer save, even when its text is identical", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    for (const newer of ["A newer saved thought", "Hi, this was sent."]) {
      const old = await store.saveContact("alice", {
        name: "Synthetic Person",
        draft: "Hi, this was sent.",
      });
      const current = await store.saveContact("alice", {
        ...old,
        draft: newer,
      });
      assert.notEqual(current.draftVersion, old.draftVersion);
      // Intentionally pass the stale object read before the newer save.
      await store.message("alice", old, {
        text: old.draft,
        direction: "out",
        expectedDraftVersion: old.draftVersion,
      });
      const after = await store.contact("alice", old.id);
      assert.equal(after.draft, newer);
      assert.equal(after.draftVersion, current.draftVersion);
    }
  } finally {
    db.close();
  }
});

test("draft clear requires exact text and an outgoing nonhistorical event; retry cannot clear later work", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    for (const change of [
      { text: "Different text" },
      { direction: "in" },
      { at: "2020-01-01T00:00:00Z" },
    ]) {
      const person = await store.saveContact("alice", {
        name: "Synthetic Person",
        draft: "Keep this",
        lastContactAt: "2025-01-01T00:00:00Z",
      });
      await store.message("alice", person, {
        text: person.draft,
        direction: "out",
        expectedDraftVersion: person.draftVersion,
        ...change,
      });
      assert.equal(
        (await store.contact("alice", person.id)).draft,
        person.draft,
      );
    }
    const person = await store.saveContact("alice", {
      name: "Retry Person",
      draft: "Sent once",
    });
    const body = {
      id: "stable",
      text: person.draft,
      direction: "out",
      expectedDraftVersion: person.draftVersion,
    };
    await store.message("alice", person, body);
    const newer = await store.saveContact("alice", {
      ...(await store.contact("alice", person.id)),
      draft: person.draft,
    });
    const before = await store.snapshot("alice");
    await store.message("alice", newer, {
      ...body,
      expectedDraftVersion: newer.draftVersion,
    });
    assert.deepEqual(await store.snapshot("alice"), before);
  } finally {
    db.close();
  }
});

test("legacy/imported drafts can be cleared explicitly; malformed version guards cannot write", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    await store.import("alice", {
      contacts: [
        { id: "legacy", name: "Legacy Person", draft: "Legacy draft" },
      ],
    });
    const body = {
      text: "Legacy draft",
      direction: "out",
      expectedDraftVersion: "",
    };
    const before = await store.snapshot("alice");
    for (const bad of [null, {}, [], 1, "not-a-version", "a".repeat(1000)]) {
      assert.equal(
        (
          await api(
            request("legacy", { ...body, expectedDraftVersion: bad }),
            { DB: db },
            "alice",
          )
        ).status,
        400,
      );
    }
    assert.deepEqual(await store.snapshot("alice"), before);
    assert.equal(
      (await api(request("legacy", body), { DB: db }, "alice")).status,
      201,
    );
    assert.equal((await store.contact("alice", "legacy")).draft, "");
  } finally {
    db.close();
  }
});
