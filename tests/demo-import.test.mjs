import test from "node:test";
import assert from "node:assert/strict";
import { mergeDemoImport } from "../web/demo.js";
import { parseBackup, parseContacts } from "../shared/import.js";
import { normalizeContact } from "../shared/domain.js";
import { Store } from "../server/store.js";
import { openDatabase } from "../server/node-db.mjs";

const at = "2025-01-01T12:00:00.000Z";
const current = () => ({
  contacts: [
    normalizeContact({
      id: "existing",
      name: "Test Person",
      email: "test@example.com",
      memory: "Keep this note",
      draft: "Keep this draft",
      circleIds: ["circle"],
      needsReply: true,
    }),
  ],
  circles: [
    {
      id: "circle",
      name: "Original circle",
      memory: "Original memory",
      color: "blue",
    },
  ],
  messages: [
    {
      id: "existing-message",
      contactId: "existing",
      text: "Original history",
      direction: "in",
      at,
      source: "manual",
    },
  ],
  settings: {
    name: "Owner",
    weeklyGoal: 3,
    voice: "My current voice",
    notifications: true,
  },
  capabilities: { ai: false, linkedin: false, portability: false },
  connection: null,
});
const payload = () => ({
  contacts: [
    {
      id: "backup-match",
      name: "Test Person",
      email: "test@example.com",
      company: "Updated company",
      memory: "Do not replace",
      draft: "Do not replace",
      needsReply: false,
      circleIds: ["new-circle"],
      createdAt: at,
    },
    {
      id: "new",
      name: "New Person",
      circleIds: ["new-circle"],
      draft: "Hi New",
      createdAt: at,
    },
  ],
  circles: [
    { id: "circle", name: "Do not replace" },
    { id: "new-circle", name: "New team" },
  ],
  messages: [
    {
      id: "existing-message",
      contactId: "backup-match",
      text: "Do not replace",
      direction: "out",
      at,
    },
    {
      id: "new-message",
      contactId: "backup-match",
      text: "  Historical outgoing  ",
      direction: "out",
      at: "2024-12-01T12:00:00Z",
    },
  ],
  settings: {
    name: "Restored",
    weeklyGoal: 7,
    voice: "Brief",
    notifications: false,
  },
  capabilities: { ai: true, linkedin: true },
  connection: { enabled: true },
});
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};
const comparable = (state) => ({
  contacts: state.contacts
    .map(({ updatedAt, ...contact }) => contact)
    .sort((a, b) => a.id.localeCompare(b.id)),
  circles: [...state.circles].sort((a, b) => a.id.localeCompare(b.id)),
  messages: [...state.messages].sort((a, b) => a.id.localeCompare(b.id)),
  settings: Object.fromEntries(
    Object.entries(state.settings).filter(([key]) => key !== "lastImportedAt"),
  ),
});

test("demo restore uses the same contact, message, circle and preferences rules as server restore", async () => {
  const db = openDatabase(":memory:");
  try {
    const store = new Store(db);
    const seed = current();
    const person = await store.saveContact("alice", seed.contacts[0]);
    await store.saveCircle("alice", seed.circles[0]);
    await store.message("alice", person, seed.messages[0], false);
    await store.settings("alice", seed.settings);
    const before = { ...seed, ...(await store.snapshot("alice")) };
    const backup = freeze(payload());
    const demo = mergeDemoImport(freeze(before), backup);
    const stored = await store.import("alice", backup);
    assert.deepEqual(
      comparable(demo.state),
      comparable(await store.snapshot("alice")),
    );
    assert.equal(demo.added, stored.added);
    assert.equal(demo.updated, stored.updated);
    assert.deepEqual(demo.idMap, stored.idMap);
    assert.equal(demo.idMap["backup-match"], "existing");
    assert.equal(demo.state.settings.notifications, true);
    assert.deepEqual(demo.state.capabilities, seed.capabilities);
    assert.equal(demo.state.connection, null);
  } finally {
    db.close();
  }
});

test("repeat demo restores preserve relationship state and do not duplicate identified history or circles", () => {
  const before = freeze(current());
  const first = mergeDemoImport(before, freeze(payload()));
  const second = mergeDemoImport(first.state, payload());
  assert.equal(second.added, 0);
  assert.equal(second.updated, 2);
  assert.equal(second.state.contacts.length, 2);
  assert.equal(second.state.circles.length, 2);
  assert.equal(second.state.messages.length, 2);
  const matched = second.state.contacts.find((c) => c.id === "existing");
  for (const key of [
    "memory",
    "draft",
    "circleIds",
    "needsReply",
    "lastContactAt",
    "reminderAt",
  ])
    assert.deepEqual(matched[key], before.contacts[0][key]);
  assert.equal(second.state.messages[0].text, "Historical outgoing");
  assert.equal(second.state.messages[0].contactId, "existing");
  assert.equal(second.state.messages[1].text, "Original history");
  assert.equal(second.state.circles[0].name, "Original circle");
  assert.equal(
    second.state.contacts.find((c) => c.id === "new").draft,
    "Hi New",
  );
  assert.equal(second.state.settings.lastImportCount, 2);
  assert.ok(Date.parse(second.state.settings.lastImportedAt));
});

test("invalid demo restores reject before mutating any current collection or preferences", () => {
  const before = freeze(current());
  const snapshot = structuredClone(before);
  for (const broken of [
    { ...payload(), messages: [{ contactId: "missing", text: "Orphan" }] },
    { ...payload(), circles: [null] },
    { ...payload(), settings: [] },
    { ...payload(), messages: [{ contactId: "existing", text: "" }] },
  ]) {
    assert.throws(
      () => mergeDemoImport(before, broken),
      /Nothing was imported/,
    );
    assert.deepEqual(before, snapshot);
  }
});

test("contact-only demo imports preserve history/preferences and save their receipt", () => {
  const before = freeze(current());
  const result = mergeDemoImport(
    before,
    parseContacts("Name,Company\nCSV Person,Example"),
  );
  assert.equal(result.added, 1);
  assert.equal(result.state.contacts.length, 2);
  assert.deepEqual(result.state.messages, before.messages);
  assert.deepEqual(result.state.circles, before.circles);
  for (const [key, value] of Object.entries(before.settings))
    assert.equal(result.state.settings[key], value);
  assert.equal(result.state.settings.lastImportCount, 1);
});

test("legacy backup conversion restores its history and shared circle in demo mode", () => {
  const before = current();
  const backup = parseBackup(
    JSON.stringify([
      {
        id: "legacy",
        name: "Legacy Person",
        cluster: "Old team",
        clusterNote: "We shipped together",
        latestReply: "Hello from an old colleague",
        lastReplyAt: at,
      },
    ]),
  );
  assert.equal(backup.kind, "backup");
  const result = mergeDemoImport(before, backup);
  assert.ok(
    result.state.messages.some(
      (m) =>
        m.contactId === "legacy" && m.text === "Hello from an old colleague",
    ),
  );
  assert.ok(
    result.state.circles.some(
      (c) => c.name === "Old team" && c.memory === "We shipped together",
    ),
  );
});
