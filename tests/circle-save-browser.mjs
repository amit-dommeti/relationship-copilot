import assert from "node:assert/strict";

export async function checkCircleSave(page, base) {
  const response = await page.request.post(base + "/api/contacts", {
    headers: { origin: base },
    data: { name: "Atomic Circle Person" },
  });
  assert.equal(response.status(), 201);
  const person = await response.json();
  const stored = async () =>
    await (await page.request.get(base + "/api/state")).json();
  await page.goto(base + "/#circles");
  await page.reload();
  await page.getByRole("button", { name: "New circle", exact: true }).click();
  await page.getByLabel("Circle name").fill("Atomic Circle Crew");
  await page.getByLabel(person.name, { exact: true }).check();
  const before = await stored();
  // Legacy saves fail on their separate membership request; atomic saves fail as one request.
  const rejectContact = (route) => route.abort("failed");
  const rejectCircle = (route) =>
    route.request().postDataJSON().membership
      ? route.abort("failed")
      : route.continue();
  await page.route("**/api/contacts/*", rejectContact);
  await page.route("**/api/circles", rejectCircle);
  try {
    const failed = page.waitForEvent("requestfailed");
    await page
      .getByRole("button", { name: "Save circle", exact: true })
      .click();
    await failed;
    await page.waitForFunction(() =>
      [...document.querySelectorAll("#circle-form button")].every(
        (b) => !b.disabled,
      ),
    );
    const after = await stored();
    assert.deepEqual(
      after.circles,
      before.circles,
      "A failed circle save must not leave a half-created circle",
    );
    assert.deepEqual(after.contacts, before.contacts);
    assert.equal(
      await page.getByLabel("Circle name").inputValue(),
      "Atomic Circle Crew",
    );
    assert.equal(
      await page.getByLabel(person.name, { exact: true }).isChecked(),
      true,
    );
    const viewport = page.viewportSize();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator("#circle-form .form-actions").scrollIntoViewIfNeeded();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({ path: `test-results/circle-save-${width}.png` });
    }
    await page.setViewportSize(viewport);
  } finally {
    await page.unroute("**/api/contacts/*", rejectContact);
    await page.unroute("**/api/circles", rejectCircle);
  }
  const writes = [];
  const watch = (request) => {
    if (["POST", "PUT", "PATCH"].includes(request.method()))
      writes.push(request);
  };
  page.on("request", watch);
  try {
    await page
      .getByRole("button", { name: "Save circle", exact: true })
      .click();
    await page.locator("#circle-form").waitFor({ state: "detached" });
    assert.equal(
      writes.length,
      1,
      "Circle save must be one request, not one write per person",
    );
    assert.deepEqual(writes[0].postDataJSON().membership, {
      add: [person.id],
      remove: [],
    });
  } finally {
    page.off("request", watch);
  }
  let state = await stored();
  const circle = state.circles.find((g) => g.name === "Atomic Circle Crew");
  assert.ok(circle);
  assert.deepEqual(state.contacts.find((c) => c.id === person.id).circleIds, [
    circle.id,
  ]);
  const edit = () =>
    page.locator(`[data-action="edit-circle"][data-id="${circle.id}"]`).click();

  // Untouched membership checkboxes must not reverse updates from another window.
  await edit();
  await page.getByLabel("Circle name").fill("Atomic Circle Renamed");
  const other = await page.request.post(base + "/api/circles", {
    headers: { origin: base },
    data: { name: "Other Shared Chapter" },
  });
  assert.equal(other.status(), 201);
  const otherCircle = await other.json();
  const changed = await page.request.patch(
    `${base}/api/contacts/${person.id}`,
    {
      headers: { origin: base },
      data: { circleIds: [otherCircle.id], memory: "Newer shared history" },
    },
  );
  assert.equal(changed.status(), 200);
  await page.getByRole("button", { name: "Save circle", exact: true }).click();
  await page.locator("#circle-form").waitFor({ state: "detached" });
  state = await stored();
  assert.deepEqual(state.contacts.find((c) => c.id === person.id).circleIds, [
    otherCircle.id,
  ]);
  assert.equal(
    state.contacts.find((c) => c.id === person.id).memory,
    "Newer shared history",
  );

  // Lost acknowledgement can have committed: reversing that attempt still needs a write.
  await edit();
  await page.getByLabel(person.name, { exact: true }).check();
  const endpoint = `**/api/circles/${circle.id}`;
  const loseConfirmation = async (route) => {
    const response = await route.fetch();
    assert.equal(response.status(), 200);
    await route.abort("failed");
  };
  await page.route(endpoint, loseConfirmation);
  try {
    await page
      .getByRole("button", { name: "Save circle", exact: true })
      .click();
    await page.locator('#circle-form[aria-busy="false"]').waitFor();
    assert.ok(
      (await stored()).contacts
        .find((c) => c.id === person.id)
        .circleIds.includes(circle.id),
    );
  } finally {
    await page.unroute(endpoint, loseConfirmation);
  }
  await page.getByLabel(person.name, { exact: true }).uncheck();
  await page.getByRole("button", { name: "Save circle", exact: true }).click();
  await page.locator("#circle-form").waitFor({ state: "detached" });
  assert.deepEqual(
    (await stored()).contacts.find((c) => c.id === person.id).circleIds,
    [otherCircle.id],
  );

  // Pending forms freeze their submitted controls, block duplicates, and leave later editors alone.
  await edit();
  await page.getByLabel("What connects you?").fill("A delayed shared chapter");
  let release,
    reached,
    job,
    count = 0;
  const gate = new Promise((resolve) => (release = resolve));
  const started = new Promise((resolve) => (reached = resolve));
  const hold = (route) => {
    job = (async () => {
      count++;
      reached();
      await gate;
      await route.continue();
    })();
    return job;
  };
  await page.route(endpoint, hold);
  try {
    await page
      .getByRole("button", { name: "Save circle", exact: true })
      .click();
    await started;
    assert.equal(await page.getByLabel("Circle name").isDisabled(), true);
    assert.equal(
      await page.getByLabel(person.name, { exact: true }).isDisabled(),
      true,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Save circle", exact: true })
        .isDisabled(),
      true,
    );
    await page.locator("#circle-form").evaluate((form) => form.requestSubmit());
    assert.equal(
      await page.evaluate(() => {
        const e = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(e);
        return e.defaultPrevented;
      }),
      true,
    );
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Explore demo", exact: true })
      .click();
    await page
      .getByText(
        "Wait for this circle to finish saving before switching workspaces or importing.",
        { exact: true },
      )
      .waitFor();
    await page
      .getByRole("button", { name: "Add person", exact: true })
      .first()
      .click();
    await page
      .getByLabel("Name", { exact: true })
      .fill("Keep this unrelated form");
    release();
    await page.waitForFunction(() => {
      const e = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(e);
      return !e.defaultPrevented;
    });
    assert.equal(count, 1);
    assert.equal(
      await page.getByLabel("Name", { exact: true }).inputValue(),
      "Keep this unrelated form",
    );
    await page.keyboard.press("Escape");
  } finally {
    release();
    await job;
    await page.unroute(endpoint, hold);
  }

  // Confirmed creation identity survives a failed state refresh, so retry uses PUT.
  await page.getByRole("button", { name: "New circle", exact: true }).click();
  await page.getByLabel("Circle name").fill("Refresh Retry Crew");
  await page.route("**/api/state", rejectContact);
  try {
    await page
      .getByRole("button", { name: "Save circle", exact: true })
      .click();
    await page.locator('#circle-form[aria-busy="false"]').waitFor();
    assert.ok(await page.locator("#circle-form").getAttribute("data-id"));
  } finally {
    await page.unroute("**/api/state", rejectContact);
  }
  const retry = page.waitForRequest(
    (r) => r.method() === "PUT" && r.url().includes("/api/circles/"),
  );
  await page.getByRole("button", { name: "Save circle", exact: true }).click();
  await retry;
  await page.locator("#circle-form").waitFor({ state: "detached" });
  assert.equal(
    (await stored()).circles.filter((g) => g.name === "Refresh Retry Crew")
      .length,
    1,
  );

  // Demo storage failure must not partially replace either collection.
  await page.goto(base + "/?demo=1#circles");
  await page.getByRole("button", { name: "New circle", exact: true }).click();
  await page.getByLabel("Circle name").fill("Demo Atomic Crew");
  await page.locator('#circle-form input[name="members"]').first().check();
  const demoBefore = await page.evaluate(() =>
    localStorage.getItem("rc-demo-v2"),
  );
  await page.evaluate(() => {
    window.restoreCircleStorage = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "rc-demo-v2")
        throw new DOMException("Synthetic quota failure", "QuotaExceededError");
      return window.restoreCircleStorage.call(this, key, value);
    };
  });
  try {
    await page
      .getByRole("button", { name: "Save circle", exact: true })
      .click();
    await page
      .getByText(
        "This browser couldn't save the circle. Your demo is unchanged.",
        { exact: true },
      )
      .waitFor();
    assert.equal(
      await page.evaluate(() => localStorage.getItem("rc-demo-v2")),
      demoBefore,
    );
  } finally {
    await page.evaluate(() => {
      Storage.prototype.setItem = window.restoreCircleStorage;
      delete window.restoreCircleStorage;
    });
  }
  await page.getByRole("button", { name: "Save circle", exact: true }).click();
  await page.locator("#circle-form").waitFor({ state: "detached" });
  await page.reload();
  await page
    .getByRole("heading", { name: "Demo Atomic Crew", exact: true })
    .waitFor();
  const demoSaved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("rc-demo-v2")),
  );
  const demoCircle = demoSaved.circles.find(
    (g) => g.name === "Demo Atomic Crew",
  );
  assert.equal(
    demoSaved.contacts.filter((c) => c.circleIds.includes(demoCircle.id))
      .length,
    1,
  );
  assert.equal(
    (await stored()).circles.some((g) => g.name === "Demo Atomic Crew"),
    false,
  );
  console.log(
    "Circle browser checks passed: failed save leaves no partial circle, one-request retry, untouched memberships and notes preserved, lost-acknowledgement revert, pending controls/guards, unrelated form retention, refresh-failure identity, and demo storage rollback/reload isolation.",
  );
}

export async function checkCircleDraftTiming(page, base) {
  const post = async (path, data) => {
    const r = await page.request.post(base + path, {
      headers: { origin: base },
      data,
    });
    assert.equal(r.status(), 201);
    return r.json();
  };
  const person = await post("/api/contacts", {
    name: "Circle Draft Timing Person",
    draft: "Hi, older draft.",
  });
  const circle = await post("/api/circles", { name: "Circle Timing Snapshot" });
  await page.goto(base + "/#circles");
  await page.reload();
  let release,
    reached,
    job,
    held = false;
  const gate = new Promise((resolve) => (release = resolve));
  const started = new Promise((resolve) => (reached = resolve));
  const holdFirstRefresh = (route) => {
    if (held) return route.continue();
    held = true;
    job = (async () => {
      const response = await route.fetch();
      reached();
      await gate;
      await route.fulfill({ response });
    })();
    return job;
  };
  await page.route("**/api/state", holdFirstRefresh);
  try {
    await page.waitForRequest((r) => r.url() === base + "/api/state", {
      timeout: 35000,
    });
    await started;
    await page.locator('nav a[href="#people"]').click();
    await page.getByLabel("Search people").fill(person.name);
    await page
      .locator(`[data-action="person"][data-id="${person.id}"]`)
      .click();
    await page
      .getByLabel("Message draft")
      .fill("Hi, newer draft after the refresh started.");
    await page.waitForFunction(
      () =>
        document.querySelector("#draft-saved")?.textContent === "Draft saved",
    );
    await page.keyboard.press("Escape");
    await page.locator('nav a[href="#circles"]').click();
    await page
      .locator(`[data-action="edit-circle"][data-id="${circle.id}"]`)
      .click();
    await page.getByLabel("Circle name").fill("Circle Timing Updated");
    await page.getByLabel(person.name, { exact: true }).check();
    await page
      .getByRole("button", { name: "Save circle", exact: true })
      .click();
    await page.locator("#circle-form").waitFor({ state: "detached" });
    await page
      .getByRole("heading", { name: "Circle Timing Updated", exact: true })
      .waitFor();
    release();
    // The older metadata can still arrive; the acknowledged draft and token must stay paired.
    await page
      .getByRole("heading", { name: "Circle Timing Snapshot", exact: true })
      .waitFor();
    await page.locator('nav a[href="#people"]').click();
    await page.getByLabel("Search people").fill(person.name);
    await page
      .locator(`[data-action="person"][data-id="${person.id}"]`)
      .click();
    assert.equal(
      await page.getByLabel("Message draft").inputValue(),
      "Hi, newer draft after the refresh started.",
    );
    await page.getByRole("button", { name: "I sent it", exact: true }).click();
    await page.locator('[role="dialog"]').waitFor({ state: "detached" });
    const stored = await (await page.request.get(base + "/api/state")).json();
    assert.equal(
      stored.contacts.find((c) => c.id === person.id).draft,
      "",
      "The next recorded send must clear its matching saved draft",
    );
    assert.equal(
      stored.messages.filter((m) => m.contactId === person.id).length,
      1,
    );
  } finally {
    release();
    await job;
    await page.unroute("**/api/state", holdFirstRefresh);
  }
  console.log(
    "Circle draft-timing browser check passed: delayed refresh, newer autosave, membership change, and next recorded send keep the draft/version pair consistent.",
  );
}
