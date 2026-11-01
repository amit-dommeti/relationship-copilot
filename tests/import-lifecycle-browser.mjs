import assert from "node:assert/strict";

export async function checkImportPageFocus(page, base) {
  for (let n = 1; n <= 30; n++) {
    const response = await page.request.post(base + "/api/contacts", {
      headers: { origin: base },
      data: { name: `Paging Focus ${String(n).padStart(2, "0")}` },
    });
    assert.equal(response.status(), 201);
  }
  await page.goto(base + "/#people");
  await page.reload();
  await page.getByLabel("Search people").fill("Paging Focus");
  assert.equal(
    await page.locator('#people-results [data-action="person"]').count(),
    30,
  );
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.locator("#import-file").setInputFiles({
    name: "Connections.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Name,Company\nPaging Focus 00,Test Company"),
  });
  let release, held;
  const gate = new Promise((r) => (release = r));
  const hold = (route) => {
    held = gate.then(() => route.continue());
    return held;
  };
  await page.route("**/api/import", hold);
  try {
    const requested = page.waitForRequest(
      (r) => r.url() === base + "/api/import",
    );
    await page
      .getByRole("button", { name: "Import contacts", exact: true })
      .click();
    await requested;
    await page.keyboard.press("Escape");
    const last = page.locator('#people-results [data-action="person"]').last();
    await last.focus();
    await last.scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => window.scrollY > 0));
    release();
    await page
      .getByRole("button", { name: "Next page", exact: true })
      .waitFor();
    const search = page.getByLabel("Search people");
    assert.equal(
      await search.evaluate((el) => el === document.activeElement),
      true,
    );
    assert.equal(
      await search.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= innerHeight;
      }),
      true,
      "When an imported row shifts the focused person off the page, fallback search focus must be visible",
    );
  } finally {
    release();
    await held;
    await page.unroute("**/api/import", hold);
  }
  console.log(
    "Import pagination focus check passed: a displaced row returns to visible Search.",
  );
}

export async function checkImportLifecycle(page, base) {
  const csv = (name) => ({
    name: "Connections.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      `Name,Company,Role,URL\n${name},Test Company,Designer,`,
    ),
  });
  await page.goto(base + "/#people");
  await page.reload();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page
    .locator("#import-file")
    .setInputFiles(csv("Import Lifecycle Person"));
  const confirm = page.getByRole("button", {
    name: "Import contacts",
    exact: true,
  });
  await confirm.waitFor();
  let release,
    reached,
    job,
    writes = 0;
  const gate = new Promise((r) => (release = r));
  const started = new Promise((r) => (reached = r));
  const hold = (route) => {
    writes++;
    job = (async () => {
      reached();
      await gate;
      await route.continue();
    })();
    return job;
  };
  await page.route("**/api/import", hold);
  try {
    await confirm.click();
    await started;
    assert.equal(await page.locator("#import-file").isDisabled(), true);
    assert.equal(await page.locator("#import-circle").isDisabled(), true);
    assert.equal(await confirm.isDisabled(), true);
    await page
      .getByRole("status")
      .filter({ hasText: "Saving your import..." })
      .waitFor();
    assert.equal(
      await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      }),
      true,
      "Leaving during an import must warn about pending work",
    );
    await confirm.dispatchEvent("click");
    await page.locator("#dropzone").evaluate((el) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File(
          ["Name,Company\nNot Confirmed Person,Other"],
          "replacement.csv",
          { type: "text/csv" },
        ),
      );
      el.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }),
      );
    });
    assert.equal(
      await page
        .locator("#import-preview")
        .getByText("Import Lifecycle Person", { exact: true })
        .count(),
      1,
    );
    const viewport = page.viewportSize();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator("#import-status").scrollIntoViewIfNeeded();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: `test-results/import-pending-${width}.png`,
      });
    }
    await page.setViewportSize(viewport);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Import", exact: true }).click();
    assert.equal(
      await page.locator("#import-file").count(),
      0,
      "A second import cannot start while the first is saving",
    );
    await page
      .getByRole("button", { name: "Explore demo", exact: true })
      .click();
    assert.equal(new URL(page.url()).searchParams.has("demo"), false);
    await page
      .getByRole("button", { name: "Add person", exact: true })
      .first()
      .click();
    const name = page.getByRole("textbox", { name: "Name", exact: true });
    await name.fill("Unrelated person still being edited");
    const refreshed = page.waitForResponse(
      (r) => r.url() === base + "/api/state",
    );
    release();
    await refreshed;
    await page
      .getByText("1 people added. 0 existing contacts updated.", {
        exact: true,
      })
      .waitFor();
    assert.equal(
      await name.count(),
      1,
      "An import completing later must not close another editor",
    );
    assert.equal(
      await name.inputValue(),
      "Unrelated person still being edited",
    );
    assert.equal(
      await name.evaluate((el) => el === document.activeElement),
      true,
    );
    const state = await (await page.request.get(base + "/api/state")).json();
    assert.equal(
      state.contacts.filter((c) => c.name === "Import Lifecycle Person").length,
      1,
    );
    assert.equal(
      state.contacts.some((c) => c.name === "Not Confirmed Person"),
      false,
    );
    assert.equal(writes, 1);
    await page.keyboard.press("Escape");
    assert.equal(
      await page
        .locator("#people-results")
        .getByText("Import Lifecycle Person", { exact: true })
        .count(),
      1,
      "Imported rows must appear after closing the other editor, without reload or navigation",
    );
  } finally {
    release();
    await job;
    await page.unroute("**/api/import", hold);
  }
  // Updating visible results preserves active search text/selection and row focus.
  for (const mode of ["search", "result"]) {
    await page.getByRole("button", { name: "Import", exact: true }).click();
    const importedName = `Import ${mode} Focus Person`;
    await page.locator("#import-file").setInputFiles(csv(importedName));
    let finish, held;
    const pending = new Promise((r) => (finish = r));
    const holdFocusImport = (route) => {
      held = pending.then(() => route.continue());
      return held;
    };
    await page.route("**/api/import", holdFocusImport);
    try {
      const requested = page.waitForRequest(
        (r) => r.url() === base + "/api/import",
      );
      await confirm.click();
      await requested;
      await page.keyboard.press("Escape");
      const search = page.getByLabel("Search people");
      await search.fill("Import");
      let focusedId;
      if (mode === "search") {
        await search.evaluate((el) => el.setSelectionRange(1, 4));
      } else {
        const row = page
          .locator('#people-results [data-action="person"]')
          .first();
        focusedId = await row.getAttribute("data-id");
        await row.focus();
      }
      finish();
      await page
        .locator("#people-results")
        .getByText(importedName, { exact: true })
        .waitFor();
      assert.equal(await search.inputValue(), "Import");
      if (mode === "search") {
        assert.deepEqual(
          await search.evaluate((el) => [
            el === document.activeElement,
            el.selectionStart,
            el.selectionEnd,
          ]),
          [true, 1, 4],
        );
      } else {
        assert.equal(
          await page
            .locator(`[data-action="person"][data-id="${focusedId}"]`)
            .evaluate((el) => el === document.activeElement),
          true,
        );
      }
    } finally {
      finish();
      await held;
      await page.unroute("**/api/import", holdFocusImport);
    }
  }

  // Failure unlocks the same preview for retry, without a partial write.
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.locator("#import-file").setInputFiles(csv("Import Retry Person"));
  const before = await (await page.request.get(base + "/api/state")).json();
  const reject = (route) => route.abort("failed");
  await page.route("**/api/import", reject);
  try {
    await confirm.click();
    await page
      .locator("#import-save-error")
      .filter({ hasText: /.+/ })
      .waitFor();
    await page.waitForFunction(
      () => !document.querySelector('[data-action="confirm-import"]').disabled,
    );
    assert.equal(await page.locator("#import-file").isDisabled(), false);
    assert.equal(await page.locator("#import-circle").isDisabled(), false);
    assert.equal(await page.locator("#import-status").count(), 0);
    assert.deepEqual(
      await (await page.request.get(base + "/api/state")).json(),
      before,
    );
  } finally {
    await page.unroute("**/api/import", reject);
  }
  await confirm.click();
  await page.locator('[role="dialog"]').waitFor({ state: "detached" });
  await page.reload();
  await page.getByRole("button", { name: "Import", exact: true }).waitFor();
  const state = await (await page.request.get(base + "/api/state")).json();
  assert.equal(
    state.contacts.filter((c) => c.name === "Import Retry Person").length,
    1,
  );

  // A failure arriving after dismissal also leaves a replacement editor alone.
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page
    .locator("#import-file")
    .setInputFiles(csv("Rejected Import Person"));
  let rejectNow, rejectedJob;
  const rejectGate = new Promise((r) => (rejectNow = r));
  const delayedReject = (route) => {
    rejectedJob = rejectGate.then(() => route.abort("failed"));
    return rejectedJob;
  };
  await page.route("**/api/import", delayedReject);
  try {
    const requested = page.waitForRequest(
      (r) => r.url() === base + "/api/import",
    );
    await confirm.click();
    await requested;
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Add person", exact: true })
      .first()
      .click();
    const name = page.getByRole("textbox", { name: "Name", exact: true });
    await name.fill("Keep after a failed import");
    const failed = page.waitForEvent(
      "requestfailed",
      (r) => r.url() === base + "/api/import",
    );
    rejectNow();
    await failed;
    await page.locator("#toast .error").filter({ hasText: /fetch/i }).waitFor();
    assert.equal(await name.inputValue(), "Keep after a failed import");
    assert.equal(
      await name.evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await page.locator("#import-file").waitFor();
    await page.keyboard.press("Escape");
  } finally {
    rejectNow();
    await rejectedJob;
    await page.unroute("**/api/import", delayedReject);
  }
  console.log(
    "Import lifecycle browser checks passed: pending controls/drop/duplicate guards, unload and workspace guards, unrelated editor/focus preservation, immediate People rows with search/row focus retained, failure/retry and reload persistence, and desktop/mobile pending status.",
  );
}
