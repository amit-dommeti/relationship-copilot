import assert from "node:assert/strict";

export async function checkPersonFormSafety(page, base) {
  const post = async (path, data) => {
    const response = await page.request.post(base + path, {
      headers: { origin: base },
      data,
    });
    assert.equal(response.status(), 201);
    return response.json();
  };
  const circle = await post("/api/circles", {
    name: "Form Safety Circle",
    color: "green",
  });
  const person = await post("/api/contacts", {
    name: "Form Safety Person",
    company: "Original company",
    role: "Original role",
    memory: "Original memory",
    cadence: 21,
    lastContactAt: "2025-01-15T15:30:00Z",
  });
  const open = async () => {
    await page.goto(base + "/#people");
    await page.reload();
    await page.getByLabel("Search people").fill(person.name);
    await page
      .locator(`[data-action="person"][data-id="${person.id}"]`)
      .click();
    await page
      .getByRole("button", { name: "Edit person", exact: true })
      .click();
  };
  const stored = async () =>
    (await (await page.request.get(base + "/api/state")).json()).contacts.find(
      (c) => c.id === person.id,
    );
  const patches = [];
  const endpoint = `**/api/contacts/${person.id}`;
  const capture = async (route) => {
    patches.push(route.request().postDataJSON());
    await route.continue();
  };
  const submitFailedSave = async () => {
    const failed = page.waitForEvent("requestfailed", {
      predicate: (request) =>
        request.url() === `${base}/api/contacts/${person.id}` &&
        request.method() === "PATCH",
    });
    await page
      .getByRole("button", { name: "Save person", exact: true })
      .click();
    await failed;
    await page.waitForFunction(() => {
      const form = document.querySelector("#person-form");
      return (
        form &&
        [...form.querySelectorAll("button")].every((button) => !button.disabled)
      );
    });
  };
  await page.route(endpoint, capture);
  try {
    await open();
    const viewport = page.viewportSize();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({ path: `test-results/person-form-${width}.png` });
    }
    await page.setViewportSize(viewport);
    await page
      .getByLabel("How do you know each other?")
      .fill("We worked together on onboarding at Square.");
    const remote = await page.request.patch(
      `${base}/api/contacts/${person.id}`,
      {
        headers: { origin: base },
        data: {
          company: "New company",
          role: "New role",
          circleIds: [circle.id],
        },
      },
    );
    assert.equal(remote.status(), 200);
    const message = await post(`/api/contacts/${person.id}/messages`, {
      direction: "out",
      text: "Hi, I sent this while the form was open.",
    });
    await page
      .getByRole("button", { name: "Save person", exact: true })
      .click();
    await page.locator("#person-form").waitFor({ state: "detached" });
    const saved = await stored();
    assert.equal(
      saved.company,
      "New company",
      "Editing a note must not restore an older company",
    );
    assert.equal(saved.role, "New role");
    assert.deepEqual(saved.circleIds, [circle.id]);
    assert.equal(saved.lastContactAt, message.at);
    assert.equal(saved.cadence, 21);
    assert.equal(saved.memory, "We worked together on onboarding at Square.");
    assert.deepEqual(patches, [{ memory: saved.memory }]);

    // Opening and saving untouched controls must not round timestamps or reset imported rhythms.
    await open();
    assert.equal(await page.getByLabel("Check-in rhythm").inputValue(), "21");
    const before = await stored();
    await page
      .getByRole("button", { name: "Save person", exact: true })
      .click();
    await page.locator("#person-form").waitFor({ state: "detached" });
    assert.deepEqual(await stored(), before);
    assert.equal(
      patches.length,
      1,
      "An unchanged form should not make a write",
    );

    // Intentional clearing and date/circle changes must still be writable.
    await open();
    await page.getByLabel("Current company").fill("");
    await page.getByLabel("Last time you spoke").fill("2025-02-20");
    await page.getByLabel("Check-in rhythm").selectOption("30");
    await page.getByLabel("Form Safety Circle", { exact: true }).uncheck();
    await page
      .getByRole("button", { name: "Save person", exact: true })
      .click();
    await page.locator("#person-form").waitFor({ state: "detached" });
    const changed = await stored();
    assert.equal(changed.company, "");
    assert.equal(changed.lastContactAt, "2025-02-20T00:00:00.000Z");
    assert.equal(changed.cadence, 30);
    assert.deepEqual(changed.circleIds, []);
    assert.deepEqual(Object.keys(patches.at(-1)).sort(), [
      "cadence",
      "circleIds",
      "company",
      "lastContactAt",
    ]);

    // A rejected save keeps its opening baseline and latest values for retry.
    await open();
    await page
      .getByLabel("How do you know each other?")
      .fill("A failed edit to retry.");
    const reject = (route) => route.abort("failed");
    await page.route(endpoint, reject);
    await submitFailedSave();
    assert.equal(
      await page.getByLabel("How do you know each other?").inputValue(),
      "A failed edit to retry.",
    );
    assert.deepEqual(await stored(), changed);
    await page.unroute(endpoint, reject);
    const later = await page.request.patch(
      `${base}/api/contacts/${person.id}`,
      {
        headers: { origin: base },
        data: { role: "Latest role" },
      },
    );
    assert.equal(later.status(), 200);
    await page
      .getByLabel("How do you know each other?")
      .fill("My newer note for the retry.");
    await page
      .getByRole("button", { name: "Save person", exact: true })
      .click();
    await page.locator("#person-form").waitFor({ state: "detached" });
    assert.equal((await stored()).memory, "My newer note for the retry.");
    assert.equal((await stored()).role, "Latest role");
    assert.deepEqual(patches.at(-1), {
      memory: "My newer note for the retry.",
    });

    // A lost acknowledgement is ambiguous: retrying a revert still needs a write.
    await open();
    const original = (await stored()).memory;
    let committed = false;
    const loseConfirmation = async (route) => {
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      committed = true;
      await route.abort("failed");
    };
    await page.route(endpoint, loseConfirmation);
    await page
      .getByLabel("How do you know each other?")
      .fill("Saved, but its confirmation was lost.");
    await submitFailedSave();
    assert.equal(committed, true);
    assert.equal(
      (await stored()).memory,
      "Saved, but its confirmation was lost.",
    );
    await page.unroute(endpoint, loseConfirmation);
    await page.getByLabel("How do you know each other?").fill(original);
    await page
      .getByRole("button", { name: "Save person", exact: true })
      .click();
    await page.locator("#person-form").waitFor({ state: "detached" });
    assert.equal(
      (await stored()).memory,
      original,
      "Reverting an unconfirmed save must reach storage",
    );
    assert.deepEqual(patches.at(-1), { memory: original });
    console.log(
      "Person-form browser checks passed: stale untouched fields preserved, precise conversation date and imported rhythm retained, no-op saves make no writes, explicit clearing/date/circle edits persist, failed saves retry the latest note, lost-acknowledgement reverts persist, and desktop/mobile form framing.",
    );
  } finally {
    await page.unroute(endpoint, capture);
  }
}
