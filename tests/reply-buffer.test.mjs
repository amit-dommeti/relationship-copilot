import test from "node:test";
import assert from "node:assert/strict";
import { createReplyBuffer } from "../web/reply-buffer.js";

const reply = { text: "A synthetic reply", direction: "in" };

test("reply buffers isolate people and workspaces without persisting private text", () => {
  const buffers = createReplyBuffer();
  buffers.stage("private", "one", reply);
  buffers.stage("private", "two", {
    text: "A different reply",
    direction: "out",
  });
  assert.deepEqual(buffers.values("private", "one"), reply);
  assert.equal(buffers.values("demo", "one").text, "");
  const copy = buffers.values("private", "one");
  copy.text = "Must not mutate the stored buffer";
  assert.deepEqual(buffers.values("private", "one"), reply);
  assert.equal(buffers.firstUnsaved("private"), "one");
  assert.equal(buffers.firstUnsaved("demo"), undefined);
});

test("repeated submission cannot create another save while one is pending", () => {
  const buffers = createReplyBuffer();
  const job = buffers.begin("private", "one", reply);
  assert.equal(buffers.begin("private", "one", reply), null);
  assert.equal(buffers.status("private", "one"), "saving");
  assert.equal(buffers.hasPending(), true);
  assert.ok(buffers.begin("private", "two", reply));
  assert.equal(buffers.finish(job, true), true);
  assert.equal(buffers.finish(job, false), false);
  assert.equal(buffers.values("private", "one").text, "");
});

test("save failure retains reply text and direction for retry", () => {
  const buffers = createReplyBuffer();
  const values = { ...reply, direction: "out" };
  const first = buffers.begin("private", "one", values);
  buffers.finish(first, false);
  assert.deepEqual(buffers.values("private", "one"), values);
  assert.equal(buffers.status("private", "one"), "error");
  assert.equal(buffers.hasPending(), false);
  const retry = buffers.begin("private", "one", values);
  assert.ok(retry);
  assert.equal(buffers.finish(retry, true), true);
  assert.equal(buffers.hasUnsaved(), false);
});

test("slow successful save cannot clear newer typing or direction changes", () => {
  const buffers = createReplyBuffer();
  const job = buffers.begin("private", "one", reply);
  const newer = { text: "The next message", direction: "out" };
  buffers.stage("private", "one", newer);
  assert.equal(buffers.finish(job, true), false);
  assert.deepEqual(buffers.values("private", "one"), newer);
  assert.deepEqual(job.values, reply);
  assert.equal(buffers.status("private", "one"), "unsaved");
});

test("empty edits clear the unload warning, but not during an outstanding save", () => {
  const buffers = createReplyBuffer();
  const job = buffers.begin("private", "one", reply);
  buffers.stage("private", "one", { text: "", direction: "in" });
  assert.equal(buffers.hasUnsaved(), true);
  buffers.finish(job, true);
  assert.equal(buffers.values("private", "one").text, "");
  assert.equal(buffers.hasUnsaved(), false);
});

test("stale completions cannot clear a later attempt", () => {
  const buffers = createReplyBuffer();
  const first = buffers.begin("private", "one", reply);
  buffers.finish(first, false);
  const retry = buffers.begin("private", "one", reply);
  assert.equal(buffers.finish(first, true), false);
  assert.equal(buffers.status("private", "one"), "saving");
  buffers.finish(retry, false);
  assert.deepEqual(buffers.values("private", "one"), reply);
});
