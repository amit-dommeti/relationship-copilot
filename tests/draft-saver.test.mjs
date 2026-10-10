import test from "node:test";
import assert from "node:assert/strict";
import { createDraftSaver } from "../web/draft-saver.js";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

test("coalesces edits and persists an intentionally empty draft", async () => {
  const writes = [];
  const saver = createDraftSaver(async (...args) => writes.push(args));
  saver.stage("a", "Hi Maya");
  saver.stage("a", "");
  assert.equal(saver.hasUnsaved(), true);
  assert.equal(saver.status("a"), "pending");
  await saver.flush();
  assert.deepEqual(writes, [["a", ""]]);
  assert.equal(saver.hasUnsaved(), false);
  assert.equal(saver.status("a"), "saved");
  await saver.flush();
  assert.equal(writes.length, 1);
});

test("a failed draft is retained and can be retried without editing", async () => {
  let offline = true;
  const writes = [];
  const saver = createDraftSaver(async (...args) => {
    if (offline) throw new Error("offline");
    writes.push(args);
  });
  saver.stage("a", "Hi Maya");
  await assert.rejects(saver.flush(), /offline/);
  assert.equal(saver.status("a"), "error");
  assert.equal(saver.hasUnsaved(), true);
  offline = false;
  await saver.flush();
  assert.deepEqual(writes, [["a", "Hi Maya"]]);
  assert.equal(saver.hasUnsaved(), false);
});

test("a slow success cannot erase a newer edit, and flushes share one writer", async () => {
  const first = deferred(),
    writes = [],
    statuses = [];
  const saver = createDraftSaver(
    async (id, value) => {
      writes.push([id, value]);
      if (writes.length === 1) await first.promise;
    },
    (id) => statuses.push(saver.status(id)),
  );
  saver.stage("a", "First");
  const saving = saver.flush();
  assert.equal(saver.status("a"), "saving");
  assert.equal(saver.flush(), saving);
  saver.stage("a", "Latest");
  assert.equal(saver.status("a"), "pending");
  first.resolve();
  await saving;
  assert.deepEqual(writes, [
    ["a", "First"],
    ["a", "Latest"],
  ]);
  assert.equal(statuses.filter((s) => s === "saved").length, 1);
  assert.equal(saver.hasUnsaved(), false);
});

test("a slow failure retains the newer edit for retry", async () => {
  const first = deferred(),
    writes = [];
  const saver = createDraftSaver(async (id, value) => {
    writes.push([id, value]);
    if (writes.length === 1) await first.promise;
  });
  saver.stage("a", "First");
  const saving = saver.flush();
  saver.stage("a", "Latest");
  first.reject(new Error("offline"));
  await assert.rejects(saving, /offline/);
  assert.equal(saver.status("a"), "error");
  await saver.flush();
  assert.deepEqual(writes, [
    ["a", "First"],
    ["a", "Latest"],
  ]);
});

test("contact navigation keeps each draft queued through a failed batch", async () => {
  let offline = true;
  const writes = [];
  const saver = createDraftSaver(async (...args) => {
    if (offline) throw new Error("offline");
    writes.push(args);
  });
  saver.stage("a", "Hi Maya");
  saver.stage("b", "Hi Jordan");
  await assert.rejects(saver.flush(), /offline/);
  assert.equal(saver.status("a"), "error");
  assert.equal(saver.status("b"), "error");
  saver.stage("a", "Hi Maya, how are you?");
  offline = false;
  await saver.flush();
  assert.deepEqual(writes, [
    ["a", "Hi Maya, how are you?"],
    ["b", "Hi Jordan"],
  ]);
  assert.equal(saver.hasUnsaved(), false);
});
