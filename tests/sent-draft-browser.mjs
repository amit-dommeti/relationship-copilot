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
    const refreshed = page.waitForResponse(
      (r) => r.url() === base + "/api/state",
    );
    const response = page.waitForResponse(
      (r) => r.request() === route.request(),
    );
    await route.continue();
    await (await response).finished();
    await (await refreshed).finished();
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
  const writtenFirst = await request.fetch();
  assert.equal(writtenFirst.status(), 201);
  assert.equal(
    await savedDraft(),
    newer,
    "Newer writing must survive before any browser cleanup can run",
  );
  await request.fulfill({ response: writtenFirst });
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
  await saved();
  assert.notEqual(
    (await state()).contacts.find((c) => c.id === person.id).draftVersion,
    repeated.request().postDataJSON().expectedDraftVersion,
  );
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
  await recorded(background);
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
  await recorded(captured);
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

  // A newer edit during the state refresh keeps its drawer open, with no cleanup PATCH.
  await draft().fill("Hi Timing, another recorded send for the cleanup race.");
  await saved();
  const cleanup = await start();
  let receiveState;
  const refreshing = new Promise((resolve) => {
    receiveState = resolve;
  });
  const holdState = async (route) =>
    receiveState({ route, response: await route.fetch() });
  await page.route("**/api/state", holdState);
  await cleanup.continue();
  const refreshingState = await refreshing;
  const duringClear =
    "Hi Timing, I started writing while the page was refreshing.";
  await draft().fill(duringClear);
  await draft().evaluate((el) => el.setSelectionRange(11, 11));
  await saved();
  // Metadata saves rotate the same token and must also survive the stale refresh.
  await page
    .getByRole("button", { name: "Mark as close connection", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove from close connections", exact: true })
    .waitFor();
  await draft().focus();
  await draft().evaluate((el) => el.setSelectionRange(11, 11));
  await page.unroute("**/api/state", holdState);
  await refreshingState.route.fulfill({ response: refreshingState.response });
  await finished();
  assert.equal(await draft().inputValue(), duringClear);
  assert.equal(await savedDraft(), duringClear);
  assert.equal(await draft().evaluate((el) => el.selectionStart), 11);

  // The following send must use B's acknowledged version, not A's stale refresh.
  const following = await start();
  assert.equal(
    following.request().postDataJSON().expectedDraftVersion,
    (await state()).contacts.find((c) => c.id === person.id).draftVersion,
  );
  await recorded(following);
  await page.locator('[role="dialog"]').waitFor({ state: "detached" });
  assert.equal(await savedDraft(), "");
  await open();
  await draft().fill(
    "Hi Timing, one more message for the acknowledgement check.",
  );
  await saved();

  // A lost acknowledgement leaves newer writing durable without any repair save.
  const lost = await start();
  const afterLost =
    "Hi Timing, keep this newer thought after a lost confirmation.";
  await draft().fill(afterLost);
  await saved();
  const written = await lost.fetch();
  assert.equal(written.status(), 201);
  assert.equal(await savedDraft(), afterLost);
  let cleanupWrites = 0;
  const rejectCleanup = (route) => {
    cleanupWrites++;
    return route.abort("failed");
  };
  await page.route(contactEndpoint, rejectCleanup);
  await lost.abort("failed");
  await finished();
  assert.equal(await draft().inputValue(), afterLost);
  assert.equal(await savedDraft(), afterLost);
  history = (await state()).messages.filter((m) => m.contactId === person.id);
  assert.equal(history.length, 7);
  assert.equal(cleanupWrites, 0);
  await page.unroute(contactEndpoint, rejectCleanup);

  // Another window can save a draft while the outgoing record is in flight.
  const remote = await start();
  const remoteDraft = "Hi Timing, this was saved in another window.";
  const remoteSave = await page.request.patch(
    `${base}/api/contacts/${person.id}`,
    {
      headers: { origin: base },
      data: { draft: remoteDraft },
    },
  );
  assert.equal(remoteSave.status(), 200);
  await page.route(contactEndpoint, rejectCleanup);
  await recorded(remote);
  await finished();
  assert.equal(await draft().inputValue(), remoteDraft);
  assert.equal(await savedDraft(), remoteDraft);
  assert.equal(
    cleanupWrites,
    0,
    "No browser cleanup may overwrite the remotely saved draft",
  );
  await page.unroute(contactEndpoint, rejectCleanup);

  // Logging separate outgoing history must leave the composer alone.
  await page.unroute(endpoint, hold);
  await page.getByRole("tab", { name: /Conversation/ }).click();
  await page.getByLabel("Save a message").fill("An earlier outgoing message.");
  await page.getByLabel("Message direction").selectOption("out");
  await page.getByRole("button", { name: "Save message", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#reply-form textarea")?.value === "",
  );
  assert.equal(await savedDraft(), remoteDraft);
  await page.reload();
  await open();
  assert.equal(await draft().inputValue(), remoteDraft);

  await page.keyboard.press("Escape");
  console.log(
    "Sent-draft browser checks passed: newer drafts durable before acknowledgement, identical-text versions, pending locks, form/person isolation, click-time capture, typing during refresh, lost acknowledgement without repair writes, remote-draft preservation, and outgoing-history isolation across reload.",
  );
}
