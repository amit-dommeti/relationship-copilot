import assert from "node:assert/strict";

export async function checkReplyBuffer(page, base, shots) {
  const state = async () =>
    (await page.request.get(base + "/api/state")).json();
  const person = (await state()).contacts.find((c) => c.name === "Test Person");
  const peerResponse = await page.request.post(base + "/api/contacts", {
    headers: { origin: base },
    data: { name: "Reply Buffer Peer" },
  });
  assert.equal(peerResponse.status(), 201);
  await page.goto(base + "/#people");
  await page.reload();
  const open = async (name) => {
    await page
      .getByRole("button", { name: new RegExp(name) })
      .first()
      .click();
    await page.getByRole("tab", { name: /Conversation/ }).click();
  };
  await page
    .getByRole("button", { name: /Test Person/ })
    .first()
    .click();
  await page.getByRole("tab", { name: /Conversation/ }).click();
  const reply = page.getByLabel("Save a message");
  const text = "A test reply that should survive setting a reminder.";
  await reply.fill(text);
  await page.getByLabel("Message direction").selectOption("out");
  await page.getByLabel("When should we remind you?").fill("2027-12-01T10:30");
  const saved = page.waitForResponse(
    (r) =>
      r.url().includes("/api/contacts/") && r.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Set reminder", exact: true }).click();
  assert.equal((await saved).status(), 200);
  await page
    .getByText(
      "Reminder set. Add it to your calendar for alerts while the app is closed.",
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await reply.inputValue(),
    text,
    "Saving a reminder must not erase the unsaved message",
  );
  assert.equal(await page.getByLabel("Message direction").inputValue(), "out");
  await page.getByRole("tab", { name: "Relationship", exact: true }).click();
  await page.getByRole("tab", { name: /Conversation/ }).click();
  assert.equal(await reply.inputValue(), text);
  await page.keyboard.press("Escape");
  await open("Reply Buffer Peer");
  assert.equal(await reply.inputValue(), "");
  const peerText = "A separate, unsaved reply for the other person.";
  await reply.fill(peerText);
  await page.keyboard.press("Escape");
  await open("Test Person");
  assert.equal(await reply.inputValue(), text);
  assert.equal(await page.getByLabel("Message direction").inputValue(), "out");

  const save = page.getByRole("button", { name: "Save message", exact: true });
  const endpoint = `**/api/contacts/${person.id}/messages`;
  let receive,
    count = 0;
  const hold = (route) => {
    count++;
    receive(route);
  };
  await page.route(endpoint, hold);
  const start = async () => {
    const arrived = new Promise((resolve) => {
      receive = resolve;
    });
    await save.click();
    return arrived;
  };
  const complete = async (route, fail = false) => {
    const response = page.waitForResponse(
      (r) => r.request() === route.request(),
    );
    if (fail)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Simulated message-save outage" }),
      });
    else await route.fulfill({ response: await route.fetch() });
    await (await response).finished();
    await page.waitForFunction(
      () =>
        !document.querySelector('#reply-form [data-action="submit-reply"]')
          ?.disabled,
    );
  };

  const pending = await start();
  assert.equal(await save.isDisabled(), true);
  await page.locator("#reply-form").evaluate((form) => form.requestSubmit());
  await page.waitForTimeout(80);
  assert.equal(
    count,
    1,
    "Repeated native form submission must not start a duplicate write",
  );
  await page.keyboard.press("Escape");
  await open("Test Person");
  assert.equal(
    await save.isDisabled(),
    true,
    "Pending status survives reopening the person",
  );
  const newer = "This is newer typing while the first save is pending.";
  await reply.fill(newer);
  await page.getByLabel("Message direction").selectOption("in");
  await reply.focus();
  await reply.evaluate((el) => el.setSelectionRange(5, 10));
  await complete(pending);
  assert.equal(await reply.inputValue(), newer);
  assert.equal(
    await reply.evaluate((el) => el === document.activeElement),
    true,
  );
  assert.deepEqual(
    await reply.evaluate((el) => [el.selectionStart, el.selectionEnd]),
    [5, 10],
  );
  let history = (await state()).messages.filter(
    (m) => m.contactId === person.id,
  );
  assert.equal(history.filter((m) => m.text === text).length, 1);
  assert.equal(history.filter((m) => m.text === newer).length, 0);

  const failed = await start();
  await complete(failed, true);
  await page
    .getByRole("status")
    .filter({ hasText: "Save not confirmed" })
    .waitFor();
  assert.equal(await reply.inputValue(), newer);
  await page.keyboard.press("Escape");
  await open("Test Person");
  assert.equal(await reply.inputValue(), newer);
  await page
    .getByRole("status")
    .filter({ hasText: "Save not confirmed" })
    .waitFor();
  await page.locator("#toast .toast").waitFor({ state: "detached" });
  await page.locator("#reply-form").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `${process.env.UPDATE_REPLY_SCREENSHOT ? "assets/screenshots/v2" : shots}/11-reply-recovery.png`,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#reply-form").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/11-reply-recovery-mobile.png" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });

  const warning = page.waitForEvent("dialog");
  const reload = page.reload().catch(() => {});
  const dialog = await warning;
  assert.equal(dialog.type(), "beforeunload");
  await dialog.dismiss();
  await reload;
  assert.equal(await reply.inputValue(), newer);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Explore demo", exact: true }).click();
  await page
    .getByText("Save or clear this message before switching workspaces.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await reply.inputValue(), newer);
  assert.equal(new URL(page.url()).searchParams.has("demo"), false);

  const retry = await start();
  await complete(retry);
  assert.equal(await reply.inputValue(), "");
  history = (await state()).messages.filter((m) => m.contactId === person.id);
  assert.equal(history.filter((m) => m.text === newer).length, 1);

  // Finishing a save for one person must not redraw another person's entry.
  await page.locator("#toast .toast").waitFor({ state: "detached" });
  await reply.fill("A background saved reply for the first person.");
  const background = await start();
  await page.keyboard.press("Escape");
  await open("Reply Buffer Peer");
  assert.equal(await reply.inputValue(), peerText);
  await reply.focus();
  await reply.evaluate((el) => el.setSelectionRange(2, 6));
  await complete(background);
  await page
    .getByText("Reply saved. It's in your reply queue.", { exact: true })
    .waitFor();
  assert.equal(await reply.inputValue(), peerText);
  assert.equal(
    await reply.evaluate((el) => el === document.activeElement),
    true,
  );
  assert.deepEqual(
    await reply.evaluate((el) => [el.selectionStart, el.selectionEnd]),
    [2, 6],
  );
  await reply.fill("");
  await page.keyboard.press("Escape");
  await page.unroute(endpoint, hold);
  await page.reload();
  console.log(
    "Reply-buffer browser checks passed: reminder preservation, tabs/reopening, person isolation, pending duplicate prevention, failure/retry, newer typing/cursor, reload warning, workspace-switch guard, and unrelated form preservation.",
  );
}
