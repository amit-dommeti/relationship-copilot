import assert from "node:assert/strict";

export async function checkSentDraftSafety(page, base) {
  const created = await page.request.post(base + "/api/contacts", {
    headers: { origin: base },
    data: { name: "Send Timing Person" },
  });
  assert.equal(created.status(), 201);
  const person = await created.json();
  const state = async () =>
    (await page.request.get(base + "/api/state")).json();
  const savedDraft = async () =>
    (await state()).contacts.find((c) => c.id === person.id).draft;
  const open = () =>
    page
      .getByRole("button", { name: /Send Timing Person/ })
      .first()
      .click();
  const draft = () => page.getByLabel("Message draft");
  const saved = () =>
    page.waitForFunction(
      () =>
        document.querySelector("#draft-saved")?.textContent === "Draft saved",
    );
  await page.goto(base + "/#people");
  await open();
  const sent = "Hi Timing, this is the message I already sent.";
  const newer = "Hi Timing, a newer thought I am still working on.";
  await draft().fill(sent);
  await saved();
  let receive;
  const requests = [];
  const endpoint = `**/api/contacts/${person.id}/messages`;
  const hold = (route) => {
    requests.push(route.request().postDataJSON());
    receive(route);
  };
  const start = async () => {
    const arrived = new Promise((resolve) => {
      receive = resolve;
    });
    await page.getByRole("button", { name: "I sent it", exact: true }).click();
    return arrived;
  };
  const finished = () =>
    page.waitForFunction(
      () => !document.querySelector('[data-action="mark-sent"]')?.disabled,
    );
  const recorded = async (route) => {
    const response = page.waitForResponse(
      (r) => r.request() === route.request(),
    );
    await route.continue();
    await (await response).finished();
  };
  await page.route(endpoint, hold);
  const request = await start();
  await draft().fill(newer);
  await saved();
  await draft().evaluate((el) => el.setSelectionRange(9, 9));
  const viewport = page.viewportSize();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `test-results/11-recording-send-${width}.png`,
    });
  }
  await page.setViewportSize(viewport);
  await recorded(request);
  await finished();
  assert.equal(
    await savedDraft(),
    newer,
    "Recording an older send must preserve the newer saved draft",
  );
  assert.equal(await draft().inputValue(), newer);
  assert.equal(await draft().evaluate((el) => el.selectionStart), 9);
  assert.equal(
    await draft().evaluate((el) => el === document.activeElement),
    true,
  );
  let history = (await state()).messages.filter(
    (m) => m.contactId === person.id,
  );
  assert.equal(history.length, 1);
  assert.equal(history[0].text, sent);

  // Restoring identical text is still a newer edit, not permission to clear it.
  const repeated = await start();
  await draft().fill("A temporary different thought.");
  await draft().fill(newer);
  await recorded(repeated);
  await finished();
  assert.equal(await draft().inputValue(), newer);
  assert.equal(await savedDraft(), newer);

  // Reopening preserves the pending lock; completion must not redraw another form.
  const background = await start();
  await page.keyboard.press("Escape");
  await open();
  assert.equal(
    await page
      .getByRole("button", { name: "Recording...", exact: true })
      .isDisabled(),
    true,
  );
  const count = requests.length;
  await page.locator('[data-action="mark-sent"]').dispatchEvent("click");
  await page.getByRole("tab", { name: /Conversation/ }).click();
  const reply = page.getByLabel("Save a message");
  await reply.fill("An unrelated unsaved conversation note.");
  await reply.evaluate((el) => el.setSelectionRange(5, 5));
  const backgroundCleared = page.waitForResponse(
    (r) =>
      r.request().method() === "PATCH" &&
      r.url().endsWith(`/api/contacts/${person.id}`),
  );
  await recorded(background);
  await (await backgroundCleared).finished();
  assert.equal(
    await reply.inputValue(),
    "An unrelated unsaved conversation note.",
  );
  assert.equal(
    await reply.evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(await reply.evaluate((el) => el.selectionStart), 5);
  assert.equal(requests.length, count);
  await reply.fill("");
  await page.getByRole("tab", { name: "Write a hello", exact: true }).click();
  await finished();
  assert.equal(await draft().inputValue(), "");

  // The clicked text and person stay fixed while an earlier autosave is pending.
  let receivePatch;
  const patchArrived = new Promise((resolve) => {
    receivePatch = resolve;
  });
  const contactEndpoint = `**/api/contacts/${person.id}`;
  const holdPatch = (route) => receivePatch(route);
  await page.route(contactEndpoint, holdPatch);
  const beforeFlush =
    "Hi Timing, the exact text clicked before autosave finished.";
  await draft().fill(beforeFlush);
  const arrived = new Promise((resolve) => {
    receive = resolve;
  });
  await page.getByRole("button", { name: "I sent it", exact: true }).click();
  const patch = await patchArrived;
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: /Test Person/ })
    .first()
    .click();
  const other = "Hi Test, this belongs to a completely different person.";
  await draft().fill(other);
  await draft().evaluate((el) => el.setSelectionRange(7, 7));
  await page.unroute(contactEndpoint, holdPatch);
  await patch.continue();
  const captured = await arrived;
  assert.equal(captured.request().postDataJSON().text, beforeFlush);
  const cleared = page.waitForResponse(
    (r) =>
      r.request().method() === "PATCH" &&
      r.url().endsWith(`/api/contacts/${person.id}`),
  );
  await recorded(captured);
  await (await cleared).finished();
  assert.equal(await draft().inputValue(), other);
  assert.equal(
    await draft().evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(await draft().evaluate((el) => el.selectionStart), 7);
  assert.equal(
    await page
      .getByRole("dialog", { name: "Test Person", exact: true })
      .count(),
    1,
  );
  await page.keyboard.press("Escape");
  await open();
  await finished();
  assert.equal(await draft().inputValue(), "");

  // A newer edit during the final empty-draft save must also keep its drawer open.
  await draft().fill("Hi Timing, another recorded send for the cleanup race.");
  await saved();
  const cleanup = await start();
  const clearing = new Promise((resolve) => {
    receivePatch = resolve;
  });
  await page.route(contactEndpoint, holdPatch);
  await recorded(cleanup);
  const emptyPatch = await clearing;
  assert.equal(emptyPatch.request().postDataJSON().draft, "");
  const duringClear = "Hi Timing, I started writing while cleanup was saving.";
  await draft().fill(duringClear);
  await draft().evaluate((el) => el.setSelectionRange(11, 11));
  await page.unroute(contactEndpoint, holdPatch);
  await emptyPatch.continue();
  await finished();
  assert.equal(await draft().inputValue(), duringClear);
  assert.equal(await savedDraft(), duringClear);
  assert.equal(await draft().evaluate((el) => el.selectionStart), 11);

  // Even a lost acknowledgement after the write must restore newer writing.
  const lost = await start();
  const afterLost =
    "Hi Timing, keep this newer thought after a lost confirmation.";
  await draft().fill(afterLost);
  await saved();
  const written = await lost.fetch();
  assert.equal(written.status(), 201);
  await lost.abort("failed");
  await finished();
  assert.equal(await draft().inputValue(), afterLost);
  assert.equal(await savedDraft(), afterLost);
  history = (await state()).messages.filter((m) => m.contactId === person.id);
  assert.equal(history.length, 6);

  await page.unroute(endpoint, hold);
  await page.keyboard.press("Escape");
  console.log(
    "Sent-draft browser checks passed: newer edits/cursor preserved, identical-text revisions, pending locks after reopening, unrelated form/person isolation, click-time capture before autosave, typing during cleanup, and lost-acknowledgement recovery.",
  );
}
