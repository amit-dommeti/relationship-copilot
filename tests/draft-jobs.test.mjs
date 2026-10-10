import test from "node:test";
import assert from "node:assert/strict";
import { createDraftJobs } from "../web/draft-jobs.js";

test("one pending generation per contact, with independent contacts", () => {
  const jobs = createDraftJobs();
  const first = jobs.begin("a"),
    second = jobs.begin("b");
  assert.equal(jobs.begin("a"), null);
  assert.equal(jobs.isBusy("a"), true);
  assert.equal(jobs.isCurrent(first), true);
  jobs.finish(first);
  assert.equal(jobs.isBusy("a"), false);
  assert.equal(jobs.isCurrent(second), true);
});

test("newer user changes invalidate a response without allowing duplicate work", () => {
  const jobs = createDraftJobs();
  const job = jobs.begin("a");
  jobs.invalidate("a");
  assert.equal(jobs.isCurrent(job), false);
  assert.equal(jobs.isBusy("a"), true);
  assert.equal(jobs.begin("a"), null);
  jobs.finish(job);
  assert.equal(jobs.isCurrent(jobs.begin("a")), true);
});

test("workspace changes discard all pending responses, even for identical contact IDs", () => {
  const jobs = createDraftJobs();
  const old = jobs.begin("a");
  jobs.reset();
  const current = jobs.begin("a");
  assert.equal(jobs.isCurrent(old), false);
  assert.equal(jobs.isCurrent(current), true);
  jobs.finish(old);
  assert.equal(jobs.isBusy("a"), true);
  assert.equal(jobs.isCurrent(current), true);
});

test("a finished response cannot be accepted again or clear a later request", () => {
  const jobs = createDraftJobs();
  const old = jobs.begin("a");
  jobs.finish(old);
  const current = jobs.begin("a");
  assert.equal(jobs.isCurrent(old), false);
  jobs.finish(old);
  assert.equal(jobs.isCurrent(current), true);
});

test("invalidating one contact does not discard another contact's response", () => {
  const jobs = createDraftJobs();
  const first = jobs.begin("a"),
    second = jobs.begin("b");
  jobs.invalidate("a");
  jobs.invalidate("missing");
  assert.equal(jobs.isCurrent(first), false);
  assert.equal(jobs.isCurrent(second), true);
});
