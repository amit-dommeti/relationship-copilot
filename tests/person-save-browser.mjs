import assert from "node:assert/strict";

export async function checkPersonSaveLifecycle(page, base) {
  const response = await page.request.post(base + "/api/contacts", {
    headers: { origin: base },
    data: { name: "Slow Save Person", memory: "Opening memory" },
  });
  assert.equal(response.status(), 201);
  const person = await response.json();
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
  const endpoint = `**/api/contacts/${person.id}`;
  const save = () =>
    page.getByRole("button", { name: "Save person", exact: true }).click();
  const memory = () => page.getByLabel("How do you know each other?");
  const stored = async () =>
    (await (await page.request.get(base + "/api/state")).json()).contacts;
  const hold = async (url, reject = false, afterCommit = false) => {
    let release, reached;
    const gate = new Promise((resolve) => (release = resolve));
    const started = new Promise((resolve) => (reached = resolve));
    const requests = [];
    const jobs = [];
    const handler = (route) => {
      const job = (async () => {
        requests.push(route.request().postDataJSON());
        const response = afterCommit ? await route.fetch() : null;
        reached(response ? await response.json() : null);
        await gate;
        if (reject) await route.abort("failed");
        else if (response) await route.fulfill({ response });
        else await route.continue();
      })();
      jobs.push(job);
      return job;
    };
    await page.route(url, handler);
    return {
      release,
      started,
      requests,
      dispose: async () => {
        release();
        await Promise.all(jobs);
        await page.unroute(url, handler);
      },
    };
  };

  await open();
  const first = await hold(endpoint);
  try {
    await memory().fill("Submitted memory");
    await save();
    await first.started;
    assert.equal(
      await page
        .getByRole("button", { name: "Save person", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Cancel", exact: true })
        .isEnabled(),
      true,
    );
    assert.equal(
      await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      }),
      true,
      "A pending person save must warn before leaving the page",
    );
    await page.locator("#person-form").evaluate((form) => form.requestSubmit());
    await memory().fill("Newer typing to keep");
    await memory().evaluate((field) => field.setSelectionRange(6, 12));
    first.release();
    await page.locator('#person-form[aria-busy="false"]').waitFor();
    assert.equal(await memory().inputValue(), "Newer typing to keep");
    assert.equal(
      await memory().evaluate(
        (field) =>
          field === document.activeElement &&
          field.selectionStart === 6 &&
          field.selectionEnd === 12,
      ),
      true,
      "Acknowledgement must preserve focus and cursor",
    );
    assert.equal(
      first.requests.length,
      1,
      "Repeated submit events must not queue duplicate saves",
    );
    assert.equal(
      (await stored()).find((c) => c.id === person.id).memory,
      "Submitted memory",
    );
    assert.match(
      await page.locator("#person-form [role=status]").textContent(),
      /newer changes still need saving/,
    );
    const viewport = page.viewportSize();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator("#person-form .form-actions").scrollIntoViewIfNeeded();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({ path: `test-results/person-save-${width}.png` });
    }
    await page.setViewportSize(viewport);
    await save();
    await page.locator("#person-form").waitFor({ state: "detached" });
    assert.equal(
      (await stored()).find((c) => c.id === person.id).memory,
      "Newer typing to keep",
    );
    assert.deepEqual(first.requests, [
      { memory: "Submitted memory" },
      { memory: "Newer typing to keep" },
    ]);
  } finally {
    first.release();
    await first.dispose();
  }

  // Reverting while a save is in flight is still a newer edit, not a no-op.
  await open();
  const revert = await hold(endpoint);
  try {
    await memory().fill("Temporary submitted memory");
    await save();
    await revert.started;
    await memory().fill("Newer typing to keep");
    revert.release();
    await page.locator('#person-form[aria-busy="false"]').waitFor();
    await save();
    await page.locator("#person-form").waitFor({ state: "detached" });
    assert.equal(
      (await stored()).find((c) => c.id === person.id).memory,
      "Newer typing to keep",
    );
    assert.deepEqual(revert.requests.at(-1), {
      memory: "Newer typing to keep",
    });
  } finally {
    revert.release();
    await revert.dispose();
  }

  // A slow failure retains the newest values and leaves the retry baseline intact.
  await open();
  const failed = await hold(endpoint, true);
  try {
    await memory().fill("Rejected snapshot");
    await save();
    await failed.started;
    await memory().fill("Latest note for retry");
    failed.release();
    await page.locator('#person-form[aria-busy="false"]').waitFor();
    assert.equal(await memory().inputValue(), "Latest note for retry");
    assert.match(
      await page.locator("#person-form [role=status]").textContent(),
      /Save not confirmed/,
    );
    assert.equal(
      (await stored()).find((c) => c.id === person.id).memory,
      "Newer typing to keep",
    );
  } finally {
    failed.release();
    await failed.dispose();
  }
  await save();
  await page.locator("#person-form").waitFor({ state: "detached" });
  assert.equal(
    (await stored()).find((c) => c.id === person.id).memory,
    "Latest note for retry",
  );

  // Even the read-only refresh of an untouched form must not erase new input.
  await open();
  const noop = await hold("**/api/state");
  try {
    await save();
    await noop.started;
    await memory().fill("Typed during a no-op refresh");
    noop.release();
    await page.locator('#person-form[aria-busy="false"]').waitFor();
    assert.equal(await memory().inputValue(), "Typed during a no-op refresh");
  } finally {
    noop.release();
    await noop.dispose();
  }
  await save();
  await page.locator("#person-form").waitFor({ state: "detached" });
  assert.equal(
    (await stored()).find((c) => c.id === person.id).memory,
    "Typed during a no-op refresh",
  );

  // A late completion belongs to its original editor, not the next open form.
  await open();
  const detached = await hold(endpoint);
  try {
    await memory().fill("Saved from the previous editor");
    await save();
    await detached.started;
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Explore demo", exact: true })
      .click();
    await page
      .getByText(
        "Wait for this person to finish saving before switching workspaces or importing.",
        { exact: true },
      )
      .waitFor();
    assert.equal(new URL(page.url()).searchParams.has("demo"), false);
    await page
      .getByRole("button", { name: "Add person", exact: true })
      .first()
      .click();
    await page
      .getByLabel("Name", { exact: true })
      .fill("A different unsaved person");
    const acknowledged = page.waitForResponse(
      (r) =>
        r.url() === `${base}/api/contacts/${person.id}` &&
        r.request().method() === "PATCH",
    );
    detached.release();
    await acknowledged;
    await page.waitForFunction(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return !event.defaultPrevented;
    });
    assert.equal(
      await page.getByLabel("Name", { exact: true }).inputValue(),
      "A different unsaved person",
    );
    assert.equal(
      await page.locator("#person-form").getAttribute("data-id"),
      "",
    );
    assert.equal(await page.locator("#app").evaluate((app) => app.inert), true);
    await page.keyboard.press("Escape");
  } finally {
    detached.release();
    await detached.dispose();
  }

  // Continuing a successful creation must PATCH the returned identity, not POST again.
  await page
    .getByRole("button", { name: "Add person", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Name", { exact: true })
    .fill("Continued Creation Person");
  await memory().fill("Creation snapshot");
  const creation = await hold("**/api/contacts");
  try {
    await save();
    await creation.started;
    await memory().fill("Typing after creation");
    await page.locator("#person-form").evaluate((form) => form.requestSubmit());
    creation.release();
    await page.locator('#person-form[aria-busy="false"]').waitFor();
    const id = await page.locator("#person-form").getAttribute("data-id");
    assert.ok(id);
    const updated = page.waitForRequest(
      (r) => r.url() === `${base}/api/contacts/${id}` && r.method() === "PATCH",
    );
    await save();
    assert.deepEqual((await updated).postDataJSON(), {
      memory: "Typing after creation",
    });
    await page.locator("#person-form").waitFor({ state: "detached" });
    const matches = (await stored()).filter(
      (c) => c.name === "Continued Creation Person",
    );
    assert.equal(matches.length, 1);
    assert.equal(matches[0].memory, "Typing after creation");
    assert.equal(creation.requests.length, 1);
  } finally {
    creation.release();
    await creation.dispose();
  }

  // Background refresh may observe a committed creation before its acknowledgement.
  await page.getByLabel("Search people").fill("Refreshed Creation Person");
  await page
    .getByRole("button", { name: "Add person", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Name", { exact: true })
    .fill("Refreshed Creation Person");
  const refreshed = await hold("**/api/contacts", false, true);
  try {
    await save();
    const created = await refreshed.started;
    const remote = await page.request.patch(
      `${base}/api/contacts/${created.id}`,
      {
        headers: { origin: base },
        data: { company: "Newer refreshed company" },
      },
    );
    assert.equal(remote.status(), 200);
    const refresh = page.waitForResponse(
      (r) => r.url() === base + "/api/state",
      { timeout: 35000 },
    );
    await page.keyboard.press("Escape");
    await refresh;
    await page
      .locator(".person-role")
      .filter({ hasText: "Newer refreshed company" })
      .waitFor();
    refreshed.release();
    await page.waitForFunction(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return !event.defaultPrevented;
    });
    await page.getByLabel("Search people").fill("Refreshed Creation Person");
    assert.equal(
      await page
        .locator(`[data-action="person"][data-id="${created.id}"]`)
        .count(),
      1,
      "A refreshed creation must not be added twice",
    );
    await page
      .locator(".person-role")
      .filter({ hasText: "Newer refreshed company" })
      .waitFor();
    assert.equal((await stored()).filter((c) => c.id === created.id).length, 1);
  } finally {
    refreshed.release();
    await refreshed.dispose();
  }
  console.log(
    "Person-save browser checks passed: newer typing and cursor retained, duplicate submissions blocked, pending unload/workspace guards, intentional reverts saved, unrelated editors retained, and continued creation updates one person.",
  );
}
