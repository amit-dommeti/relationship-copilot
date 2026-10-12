import assert from "node:assert/strict";

export async function checkContactPatches(page, base) {
  const created = await page.request.post(base + "/api/contacts", {
    headers: { origin: base },
    data: { name: "Two Window Person", memory: "Original shared history" },
  });
  assert.equal(created.status(), 201);
  const person = await created.json();
  const other = await page
    .context()
    .browser()
    .newPage({ viewport: page.viewportSize() });
  const errors = [];
  other.on("pageerror", (error) => errors.push(error.message));
  const open = async (tab) => {
    await tab.goto(base + "/#people");
    // Navigating to the same fragment can retain the previous in-memory list.
    await tab.reload();
    await tab.getByLabel("Search people").fill(person.name);
    await tab.locator(`[data-action="person"][data-id="${person.id}"]`).click();
  };
  const completedPatch = (tab) =>
    tab.waitForResponse(
      (r) =>
        r.url() === `${base}/api/contacts/${person.id}` &&
        r.request().method() === "PATCH",
    );
  try {
    await open(page);
    await open(other);
    await page
      .getByRole("button", { name: "Edit person", exact: true })
      .click();
    const memory = "We worked together on the Square onboarding project.";
    await page.getByLabel("How do you know each other?").fill(memory);
    await other.getByRole("tab", { name: /Conversation/ }).click();
    await other
      .getByLabel("When should we remind you?")
      .fill("2027-12-01T10:30");
    const reminderSaved = completedPatch(other);
    await other
      .getByRole("button", { name: "Set reminder", exact: true })
      .click();
    const reminderResponse = await reminderSaved;
    assert.equal(reminderResponse.status(), 200);
    const reminder = (await reminderResponse.json()).reminderAt;
    const personSaved = completedPatch(page);
    await page
      .getByRole("button", { name: "Save person", exact: true })
      .click();
    assert.equal((await personSaved).status(), 200);
    await page.locator("#person-form").waitFor({ state: "detached" });

    // Both windows began with older state. Save a draft, then a distinct flag.
    await page.keyboard.press("Escape");
    await open(page);
    const draft =
      "Hi, I was remembering our onboarding project. How have you been?";
    await page.getByLabel("Message draft").fill(draft);
    await page.waitForFunction(
      () =>
        document.querySelector("#draft-saved")?.textContent === "Draft saved",
    );
    const favoriteSaved = completedPatch(other);
    await other
      .getByRole("button", { name: "Mark as close connection", exact: true })
      .click();
    assert.equal((await favoriteSaved).status(), 200);
    const state = await (await page.request.get(base + "/api/state")).json();
    const saved = state.contacts.find((c) => c.id === person.id);
    assert.equal(saved.memory, memory);
    assert.equal(saved.reminderAt, reminder);
    assert.equal(saved.draft, draft);
    assert.equal(saved.favorite, true);

    await open(page);
    assert.equal(await page.getByLabel("Message draft").inputValue(), draft);
    await page.getByRole("tab", { name: /Conversation/ }).click();
    assert.equal(
      await page.getByLabel("When should we remind you?").inputValue(),
      "2027-12-01T10:30",
    );
    await page
      .getByRole("button", { name: "Edit person", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("How do you know each other?").inputValue(),
      memory,
    );
    assert.deepEqual(errors, []);
    await page.keyboard.press("Escape");
    console.log(
      "Contact patch browser checks passed: two open windows, relationship notes, reminders, draft and favorite saves, and reload persistence. Deterministic overlapping storage writes are covered separately by API tests.",
    );
  } finally {
    await other.close();
  }
}
