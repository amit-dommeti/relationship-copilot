import test from "node:test";
import assert from "node:assert/strict";
import { createMessageRecorder } from "../web/message-recorder.js";

const values = { text: "Test message", direction: "in" };
const fixture = () => {
  let id = 0;
  return createMessageRecorder(() => `request-${++id}`);
};

test("failed recording and failed refresh keep the same request identity for retry", async () => {
  const recorder = fixture(),
    sent = [];
  const fail = async (body) => {
    sent.push(body);
    throw new Error("Confirmation lost");
  };
  for (let n = 0; n < 2; n++)
    await assert.rejects(
      recorder.run("private", "one", values, fail),
      /Confirmation lost/,
    );
  await recorder.run("private", "one", values, async (body) => {
    sent.push(body);
  });
  assert.deepEqual(
    sent.map((b) => b.requestId),
    ["request-1", "request-1", "request-1"],
  );
  await recorder.run("private", "one", values, async (body) => {
    sent.push(body);
  });
  assert.equal(
    sent[3].requestId,
    "request-2",
    "A confirmed new recording is a new event, even with identical text",
  );
});

test("pending identical recording shares one promise and one write", async () => {
  const recorder = fixture();
  let complete,
    writes = 0;
  const send = () => {
    writes++;
    return new Promise((resolve) => {
      complete = resolve;
    });
  };
  const first = recorder.run("private", "one", values, send);
  const duplicate = recorder.run("private", "one", values, send);
  assert.equal(first, duplicate);
  await Promise.resolve();
  assert.equal(writes, 1);
  assert.equal(recorder.hasPending(), true);
  await assert.rejects(
    recorder.run("private", "one", { ...values, text: "Changed" }, send),
    /finish saving/,
  );
  complete("saved");
  assert.equal(await first, "saved");
  assert.equal(recorder.hasPending(), false);
});

test("changed text or direction gets a new identity after failure", async () => {
  const recorder = fixture(),
    identities = [];
  const fail = (body) => {
    identities.push(body.requestId);
    throw new Error("Rejected");
  };
  for (const body of [
    values,
    { ...values, text: "Changed" },
    { text: "Changed", direction: "out" },
  ])
    await assert.rejects(
      recorder.run("private", "one", body, fail),
      /Rejected/,
    );
  assert.deepEqual(identities, ["request-1", "request-2", "request-3"]);
  assert.equal(
    recorder.hasPending(),
    false,
    "Synchronous failures must release the pending lock",
  );
});

test("contact and workspace boundaries do not share retry identities", async () => {
  const recorder = fixture(),
    identities = [];
  const fail = async (body) => {
    identities.push(body.requestId);
    throw new Error("Offline");
  };
  for (const [workspace, contact] of [
    ["private", "one"],
    ["private", "two"],
    ["demo", "one"],
    ["private", "one"],
  ])
    await assert.rejects(
      recorder.run(workspace, contact, values, fail),
      /Offline/,
    );
  assert.deepEqual(identities, [
    "request-1",
    "request-2",
    "request-3",
    "request-1",
  ]);
});

test("normalized whitespace reuses an unconfirmed identity without exposing mutable state", async () => {
  const recorder = fixture(),
    identities = [];
  await assert.rejects(
    recorder.run(
      "private",
      "one",
      { ...values, text: "  Test message  " },
      async (body) => {
        identities.push(body.requestId);
        body.text = "Mutated callback data";
        throw new Error("Offline");
      },
    ),
  );
  await recorder.run("private", "one", values, async (body) => {
    identities.push(body.requestId);
    assert.equal(body.text, values.text);
  });
  assert.deepEqual(identities, ["request-1", "request-1"]);
});
