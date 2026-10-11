import assert from "node:assert/strict";

export async function checkDraftGeneration(page, base) {
  await page.locator("#toast .toast").waitFor({ state: "detached" });
  const suggestion = "Hi Test, this is a delayed test suggestion.";
  let receive;
  let requestCount = 0;
  const hold = (route) => {
    requestCount++;
    receive?.(route);
  };
  await page.route("**/api/draft", hold);
  const start = async () => {
    const arrived = new Promise((resolve) => (receive = resolve));
    await page.locator('[data-action="draft"]').click();
    return arrived;
  };
  const respond = async (
    route,
    status = 200,
    error = "Simulated drafting failure",
  ) => {
    const response = page.waitForResponse(
      (response) => response.request() === route.request(),
    );
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(
        status === 200
          ? {
              mode: "starter",
              drafts: [suggestion, "Hi Test, another test suggestion."],
              grounding: "Simulated response for a timing regression.",
              needsReview: true,
            }
          : { error },
      ),
    });
    await (await response).finished();
    await page.waitForTimeout(80);
  };
  const openPerson = () =>
    page
      .getByRole("button", { name: /Test Person/ })
      .first()
      .click();
  const draft = () => page.getByLabel("Message draft");
  const persistedDraft = async () => {
    const state = await (await page.request.get(base + "/api/state")).json();
    return state.contacts.find((c) => c.name === "Test Person").draft;
  };
  const saved = () =>
    page.waitForFunction(
      () =>
        document.querySelector("#draft-saved")?.textContent === "Draft saved",
    );

  await openPerson();
  const editing = await start();
  const handwritten =
    "Hi Test, I finally tried that cafe you mentioned. Great call!";
  await draft().fill(handwritten);
  await saved();
  await draft().evaluate((el) => el.setSelectionRange(8, 8));
  await respond(editing);
  await page.waitForFunction(
    () => !document.querySelector('[data-action="draft"]')?.disabled,
  );
  assert.equal(
    await draft().inputValue(),
    handwritten,
    "A late suggestion must not overwrite newer typing",
  );
  assert.equal(await draft().evaluate((el) => el.selectionStart), 8);
  assert.equal(
    await draft().evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(await persistedDraft(), handwritten);

  // Loading state survives tab/drawer rendering; failures restore a real action.
  const failed = await start();
  const count = requestCount;
  await page.keyboard.press("Escape");
  await openPerson();
  assert.equal(
    await page
      .getByRole("button", { name: "Writing...", exact: true })
      .isDisabled(),
    true,
  );
  await page.locator('[data-action="draft"]').dispatchEvent("click");
  assert.equal(requestCount, count);
  await page.screenshot({
    path: process.env.UPDATE_GENERATION_SCREENSHOT
      ? "assets/screenshots/v2/09-draft-in-progress.png"
      : "test-results/09-draft-in-progress.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/09-draft-in-progress-mobile.png",
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await respond(failed, 503);
  assert.equal(
    await page
      .getByRole("button", { name: "Try another draft", exact: true })
      .isEnabled(),
    true,
  );
  assert.equal(await draft().inputValue(), handwritten);

  // Changing intent also makes an outstanding suggestion stale.
  const changedIntent = await start();
  assert.equal(changedIntent.request().postDataJSON().intent, "catch-up");
  await page.getByLabel("Message intent").selectOption("thank-you");
  await respond(changedIntent);
  assert.equal(await draft().inputValue(), handwritten);

  // A valid result may save in the background, without redrawing an unrelated form.
  const inConversation = await start();
  assert.equal(inConversation.request().postDataJSON().intent, "thank-you");
  await page.getByRole("tab", { name: /Conversation/ }).click();
  const reply = "I am still writing this unsaved reply note.";
  await page.getByLabel("Save a message").fill(reply);
  await respond(inConversation);
  assert.equal(await page.getByLabel("Save a message").inputValue(), reply);
  assert.equal(
    await page
      .getByLabel("Save a message")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(await persistedDraft(), suggestion);
  await page.getByLabel("Save a message").fill("");
  await page.getByRole("tab", { name: "Write a hello", exact: true }).click();
  assert.equal(await draft().inputValue(), suggestion);

  // A late result cannot bring back the draft after a manually recorded send.
  const alreadySent = await start();
  await page.getByRole("button", { name: "I sent it", exact: true }).click();
  await page.locator('[role="dialog"]').waitFor({ state: "detached" });
  await respond(alreadySent);
  assert.equal(await persistedDraft(), "");
  await openPerson();
  assert.equal(await draft().inputValue(), "");
  await draft().fill(handwritten);
  await saved();

  // Leave and return to the real workspace before the old request completes.
  const oldWorkspace = await start();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Explore demo", exact: true }).click();
  await page.getByRole("button", { name: "Leave demo", exact: true }).click();
  await page.locator('nav a[href="#people"]').click();
  await openPerson();
  const newWorkspace = await start();
  await respond(oldWorkspace);
  assert.equal(await draft().inputValue(), handwritten);
  assert.equal(await persistedDraft(), handwritten);
  assert.equal(
    await page
      .getByRole("button", { name: "Writing...", exact: true })
      .isDisabled(),
    true,
  );
  await respond(newWorkspace);
  await saved();
  assert.equal(await draft().inputValue(), suggestion);
  assert.equal(await persistedDraft(), suggestion);

  const staleError = await start();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Explore demo", exact: true }).click();
  await respond(staleError, 503, "Stale workspace failure");
  assert.doesNotMatch(
    await page.locator("#toast").innerText(),
    /Stale workspace failure/,
  );
  await page.getByRole("button", { name: "Leave demo", exact: true }).click();
  await page.locator('nav a[href="#people"]').click();
  await openPerson();
  assert.equal(await draft().inputValue(), suggestion);

  await page.unroute("**/api/draft", hold);
  await page.keyboard.press("Escape");
  console.log(
    "Draft timing checks passed: newer edits and cursor preserved, pending state, duplicate prevention, error recovery, intent changes, unrelated form preservation, sent-draft protection, workspace isolation.",
  );
}
