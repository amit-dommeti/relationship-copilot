import assert from "node:assert/strict";

export async function checkMessageRetries(page, base) {
  const state = async () =>
    (await page.request.get(base + "/api/state")).json();
  const person = (await state()).contacts.find((c) => c.name === "Test Person");
  await page.goto(base + "/#people");
  await page
    .getByRole("button", { name: /Test Person/ })
    .first()
    .click();
  await page.getByRole("tab", { name: /Conversation/ }).click();
  const reply = page.getByLabel("Save a message");
  const save = page.getByRole("button", { name: "Save message", exact: true });
  const endpoint = `**/api/contacts/${person.id}/messages`;
  const requests = [];
  let dropNext = true;
  const intercept = async (route) => {
    requests.push(route.request().postDataJSON());
    const response = await route.fetch();
    assert.equal(response.status(), 201);
    if (dropNext) {
      dropNext = false;
      await route.abort("failed");
    } else await route.fulfill({ response });
  };
  await page.route(endpoint, intercept);
  const text = "This test reply was saved before its confirmation was lost.";
  await reply.fill(text);
  await save.click();
  await page
    .getByRole("status")
    .filter({ hasText: "Save not confirmed" })
    .waitFor();
  const first = (await state()).messages.find((m) => m.text === text);
  assert.ok(
    first,
    "The failure must occur AFTER the real local database write",
  );
  assert.equal(await reply.inputValue(), text);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: /Test Person/ })
    .first()
    .click();
  await page.getByRole("tab", { name: /Conversation/ }).click();
  assert.equal(await reply.inputValue(), text);

  // A later decision about the conversation must survive replay of the old save.
  const reminderAt = "2027-12-02T12:00:00.000Z";
  const change = await page.request.patch(`${base}/api/contacts/${person.id}`, {
    headers: { origin: base },
    data: { needsReply: false, reminderAt },
  });
  assert.equal(change.status(), 200);
  const changed = (await state()).contacts.find((c) => c.id === person.id);
  await save.click();
  await page.waitForFunction(
    () => document.querySelector("#reply-form textarea")?.value === "",
  );
  let snapshot = await state();
  assert.equal(snapshot.messages.filter((m) => m.text === text).length, 1);
  assert.deepEqual(
    snapshot.messages.find((m) => m.id === first.id),
    first,
  );
  assert.deepEqual(
    snapshot.contacts.find((c) => c.id === person.id),
    changed,
  );
  assert.equal(requests[0].requestId, requests[1].requestId);

  // A new, intentional recording after confirmation must not be text-deduplicated.
  await reply.fill(text);
  await save.click();
  await page.waitForFunction(
    () => document.querySelector("#reply-form textarea")?.value === "",
  );
  assert.notEqual(requests[2].requestId, requests[1].requestId);
  assert.equal(
    (await state()).messages.filter((m) => m.text === text).length,
    2,
  );

  // POST acknowledgement can succeed while the following state refresh fails.
  let failRefresh = true;
  const refreshFailure = (route) => {
    if (failRefresh) {
      failRefresh = false;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Simulated refresh failure" }),
      });
    }
    return route.continue();
  };
  await page.route("**/api/state", refreshFailure);
  const refreshText = "A saved test message whose following refresh failed.";
  await reply.fill(refreshText);
  await save.click();
  await page
    .getByRole("status")
    .filter({ hasText: "Save not confirmed" })
    .waitFor();
  assert.equal(
    (await state()).messages.filter((m) => m.text === refreshText).length,
    1,
  );
  await save.click();
  await page.waitForFunction(
    () => document.querySelector("#reply-form textarea")?.value === "",
  );
  assert.equal(
    (await state()).messages.filter((m) => m.text === refreshText).length,
    1,
  );
  assert.equal(requests[3].requestId, requests[4].requestId);
  await page.unroute("**/api/state", refreshFailure);

  // "I sent it" is a local history record, not an outbound LinkedIn send.
  await page.getByRole("tab", { name: "Write a hello", exact: true }).click();
  const outgoing = "Hi Test, this is a synthetic manually recorded send.";
  await page.getByLabel("Message draft").fill(outgoing);
  await page.waitForFunction(
    () => document.querySelector("#draft-saved")?.textContent === "Draft saved",
  );
  dropNext = true;
  const beforeRequests = requests.length;
  await page.getByRole("button", { name: "I sent it", exact: true }).click();
  await page.getByText("Failed to fetch", { exact: true }).waitFor();
  snapshot = await state();
  const sent = snapshot.messages.find((m) => m.text === outgoing);
  assert.ok(sent);
  assert.equal(await page.getByLabel("Message draft").inputValue(), outgoing);
  await page.getByRole("button", { name: "I sent it", exact: true }).click();
  await page.locator('[role="dialog"]').waitFor({ state: "detached" });
  snapshot = await state();
  assert.equal(snapshot.messages.filter((m) => m.text === outgoing).length, 1);
  assert.deepEqual(
    snapshot.messages.find((m) => m.id === sent.id),
    sent,
  );
  assert.equal(
    requests[beforeRequests].requestId,
    requests[beforeRequests + 1].requestId,
  );
  await page.unroute(endpoint, intercept);
  console.log(
    "Message-retry browser checks passed: dropped confirmations after actual writes, preserved later state, stable retry IDs through reopening, intentional repeat recording, failed-refresh recovery, and recorded-send retries.",
  );
}
