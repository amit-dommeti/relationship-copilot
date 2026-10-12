import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../server/node-db.mjs";
import { Store } from "../server/store.js";
import { api } from "../server/api.js";
import {
  circleMembershipChanges,
  prepareCircleSave,
} from "../shared/circle-save.js";

const save = (db, body, id = "", owner = "alice") =>
  api(
    new Request(`https://app.test/api/circles${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      headers: {
        origin: "https://app.test",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    { DB: db },
    owner,
  );

test("circle details and membership commit together, or both roll back", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const person = await store.saveContact("alice", {
      name: "Circle Test Person",
      draft: "Hi, keep this.",
    });
    const before = await store.snapshot("alice");
    const faulty = {
      ...db,
      batch: (statements) =>
        db.batch([
          ...statements,
          db
            .prepare("INSERT INTO missing_circle_test_table VALUES (?)")
            .bind("fail"),
        ]),
    };
    const response = await save(faulty, {
      name: "Square Test Crew",
      membership: { add: [person.id], remove: [] },
    });
    assert.equal(response.status, 500);
    assert.deepEqual(await store.snapshot("alice"), before);
  } finally {
    db.close();
  }
});

test("circle membership updates preserve other circles, notes, drafts, and unselected people", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const circle = await store.saveCircle("alice", { name: "Original crew" });
    const a = await store.saveContact("alice", {
      name: "A",
      circleIds: [circle.id, "other"],
      memory: "Keep my history",
      draft: "Hi A",
    });
    const b = await store.saveContact("alice", {
      name: "B",
      circleIds: ["other"],
      needsReply: true,
    });
    const archived = await store.saveContact("alice", {
      name: "Archived",
      circleIds: [circle.id],
      archived: true,
    });
    const response = await save(
      db,
      {
        name: "Updated crew",
        memory: "Shared context",
        membership: { add: [b.id, b.id], remove: [a.id] },
      },
      circle.id,
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).name, "Updated crew");
    const nextA = await store.contact("alice", a.id),
      nextB = await store.contact("alice", b.id);
    assert.deepEqual(nextA.circleIds, ["other"]);
    assert.deepEqual(nextB.circleIds, ["other", circle.id]);
    assert.equal(nextA.memory, a.memory);
    assert.equal(nextA.draft, a.draft);
    assert.equal(nextB.needsReply, true);
    assert.equal(
      nextA.draftVersion,
      a.draftVersion,
      "Membership-only writes preserve the draft and its version together",
    );
    assert.deepEqual(await store.contact("alice", archived.id), archived);
    // Reapplying an already satisfied delta must not churn contact versions.
    assert.equal(
      (
        await save(
          db,
          { name: "Updated crew", membership: { add: [b.id], remove: [a.id] } },
          circle.id,
        )
      ).status,
      200,
    );
    assert.deepEqual(await store.contact("alice", a.id), nextA);
    assert.deepEqual(await store.contact("alice", b.id), nextB);
    assert.equal(
      (await save(db, { name: "Metadata only" }, circle.id)).status,
      200,
    );
    assert.deepEqual(await store.contact("alice", b.id), nextB);
  } finally {
    db.close();
  }
});

test("invalid or foreign membership rejects before changing any circle or person", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const c = await store.saveContact("alice", { name: "A" });
    const foreign = await store.saveContact("bob", { name: "B" });
    const before = await store.snapshot("alice");
    for (const membership of [
      null,
      [],
      {},
      { add: "bad", remove: [] },
      { add: [c.id], remove: [c.id] },
      { add: [foreign.id], remove: [] },
      { add: ["missing"], remove: [] },
      { add: ["<invalid>"], remove: [] },
      { add: Array(10001).fill(c.id), remove: [] },
    ]) {
      assert.equal(
        (await save(db, { name: "Invalid", membership })).status,
        400,
      );
      assert.deepEqual(await store.snapshot("alice"), before);
    }
    assert.equal(
      (await save(db, { name: " ", membership: { add: [c.id], remove: [] } }))
        .status,
      400,
    );
    assert.deepEqual(await store.contact("bob", foreign.id), foreign);
  } finally {
    db.close();
  }
});

test("a failure after all membership writes rolls back an existing circle and every person", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const circle = await store.saveCircle("alice", { name: "Unchanged" });
    const a = await store.saveContact("alice", {
      name: "A",
      circleIds: [circle.id],
    });
    const b = await store.saveContact("alice", { name: "B" });
    const before = await store.snapshot("alice");
    let statementsRun = 0;
    const faulty = {
      ...db,
      batch: (statements) => {
        statementsRun = statements.length;
        return db.batch([
          ...statements,
          db
            .prepare("INSERT INTO missing_circle_test_table VALUES (?)")
            .bind("fail"),
        ]);
      },
    };
    assert.equal(
      (
        await save(
          faulty,
          { name: "Changed", membership: { add: [b.id], remove: [a.id] } },
          circle.id,
        )
      ).status,
      500,
    );
    assert.equal(statementsRun, 3);
    assert.deepEqual(await store.snapshot("alice"), before);
  } finally {
    db.close();
  }
});

test("membership writes merge with newer other-circle and note edits at the transaction", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const person = await store.saveContact("alice", {
      name: "A",
      circleIds: ["original"],
    });
    const interleaved = {
      ...db,
      async batch(statements) {
        await store.patchContact("alice", person, {
          circleIds: ["original", "new-other-circle"],
          memory: "Newer note",
        });
        return db.batch(statements);
      },
    };
    const response = await save(interleaved, {
      name: "Crew",
      membership: { add: [person.id], remove: [] },
    });
    assert.equal(response.status, 201);
    const circle = await response.json();
    const next = await store.contact("alice", person.id);
    assert.deepEqual(next.circleIds, [
      "original",
      "new-other-circle",
      circle.id,
    ]);
    assert.equal(next.memory, "Newer note");
  } finally {
    db.close();
  }
});

test("circle capacity rejects the whole save, including when capacity changes after validation", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const full = Array.from({ length: 30 }, (_, n) => `circle-${n}`);
    const person = await store.saveContact("alice", {
      name: "A",
      circleIds: full,
    });
    assert.equal(
      (
        await save(db, {
          name: "Too many",
          membership: { add: [person.id], remove: [] },
        })
      ).status,
      400,
    );
    assert.equal((await store.list("circles", "alice")).length, 0);
    await store.patchContact("alice", person, { circleIds: full.slice(1) });
    const interleaved = {
      ...db,
      async batch(statements) {
        await store.patchContact("alice", person, { circleIds: full });
        return db.batch(statements);
      },
    };
    assert.equal(
      (
        await save(interleaved, {
          name: "Race",
          membership: { add: [person.id], remove: [] },
        })
      ).status,
      500,
    );
    assert.equal((await store.list("circles", "alice")).length, 0);
    assert.deepEqual((await store.contact("alice", person.id)).circleIds, full);
  } finally {
    db.close();
  }
});

test("10,000 membership additions use one bounded transaction, not one request per person", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const contacts = Array.from({ length: 10000 }, (_, n) => ({
      id: `person-${n}`,
      name: `Person ${n}`,
    }));
    await store.import("alice", { contacts });
    let batches = 0,
      count = 0;
    const measured = {
      ...db,
      batch(statements) {
        batches++;
        count = statements.length;
        return db.batch(statements);
      },
    };
    const response = await save(measured, {
      name: "Large synthetic circle",
      membership: { add: contacts.map((c) => c.id), remove: [] },
    });
    assert.equal(response.status, 201);
    const circle = await response.json();
    assert.equal(batches, 1);
    assert.equal(count, 2);
    assert.equal(
      (await store.list("contacts", "alice")).filter((c) =>
        c.circleIds.includes(circle.id),
      ).length,
      10000,
    );
  } finally {
    db.close();
  }
});

test("membership intent uses opening checkboxes and retains unconfirmed reversions", () => {
  assert.deepEqual(circleMembershipChanges(["a"], ["a"]), {
    add: [],
    remove: [],
  });
  assert.deepEqual(circleMembershipChanges(["a"], ["b"]), {
    add: ["b"],
    remove: ["a"],
  });
  assert.deepEqual(circleMembershipChanges(["a"], ["a"], new Set(["a", "b"])), {
    add: ["a"],
    remove: ["b"],
  });
});

test("a recorded send can clear its matching draft after a membership-only save", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const person = await store.saveContact("alice", {
      name: "A",
      draft: "Hi, this is the saved draft.",
    });
    const acknowledged = await store.patchContact("alice", person, {
      draft: "Hi, this is my newer draft.",
    });
    assert.equal(
      (
        await save(db, {
          name: "Crew",
          membership: { add: [person.id], remove: [] },
        })
      ).status,
      201,
    );
    await store.message("alice", acknowledged, {
      text: acknowledged.draft,
      direction: "out",
      expectedDraftVersion: acknowledged.draftVersion,
    });
    assert.equal((await store.contact("alice", person.id)).draft, "");
    assert.equal((await store.list("messages", "alice")).length, 1);
  } finally {
    db.close();
  }
});

test("demo circle planning is nonmutating and rejects all changes when a member is invalid", () => {
  const contacts = [
    { id: "a", name: "A", circleIds: ["other"], draft: "Hi A" },
  ];
  const before = structuredClone(contacts);
  const plan = prepareCircleSave(contacts, {
    id: "crew",
    name: "Crew",
    membership: { add: ["a"], remove: [] },
  });
  assert.deepEqual(contacts, before);
  assert.deepEqual(plan.contacts[0].circleIds, ["other", "crew"]);
  assert.equal(plan.contacts[0].draft, "Hi A");
  assert.throws(
    () =>
      prepareCircleSave(contacts, {
        name: "Crew",
        membership: { add: ["a", "missing"], remove: [] },
      }),
    /unavailable/,
  );
  assert.deepEqual(contacts, before);
});
