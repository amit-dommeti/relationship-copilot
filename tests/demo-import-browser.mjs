import assert from "node:assert/strict";

export async function checkDemoImport(page, base) {
  const writes = [];
  const trackWrites = (request) => {
    if (
      request.url().includes("/api/") &&
      !["GET", "HEAD"].includes(request.method())
    )
      writes.push(request.url());
  };
  page.on("request", trackWrites);
  const privateBefore = await (
    await page.request.get(base + "/api/state")
  ).json();
  await page.goto(base + "/?demo=1#settings");
  await page.getByRole("heading", { name: "Make it yours" }).waitFor();
  const demo = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("rc-demo-v2")));
  if (!(await demo())) {
    await page
      .getByRole("button", { name: "Save preferences", exact: true })
      .click();
    await page.locator("#toast .toast").waitFor({ state: "detached" });
  }
  const before = await demo();
  const backup = {
    contacts: [
      {
        id: "restore-person",
        name: "Restore Test Person",
        circleIds: ["restore-circle"],
        needsReply: true,
      },
    ],
    circles: [
      {
        id: "restore-circle",
        name: "Restore teammates",
        memory: "A synthetic shared project.",
      },
    ],
    messages: [
      {
        id: "restore-message",
        contactId: "restore-person",
        text: "A synthetic reply restored from backup.",
        direction: "in",
        at: "2025-02-03T12:00:00Z",
      },
    ],
    settings: {
      name: "Restore Tester",
      weeklyGoal: 7,
      voice: "Short and direct.",
      notifications: true,
    },
  };
  const file = (value) => ({
    name: "synthetic-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(value)),
  });
  const confirm = () => page.locator('[data-action="confirm-import"]');
  const upload = async (value) => {
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await page.locator("#import-file").setInputFiles(file(value));
    await confirm().waitFor();
  };
  await page
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await page.locator("#import-file").setInputFiles(file(backup));
  await page
    .getByText(/This backup includes 1 saved message and 1 circle,/)
    .waitFor();
  await page
    .getByText(/Demo only: this import stays in this browser/)
    .waitFor();
  assert.equal(await confirm().innerText(), "Restore backup");
  const viewport = page.viewportSize();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path:
        width === 1440 && process.env.UPDATE_BACKUP_SCREENSHOT
          ? "assets/screenshots/v2/12-backup-preview.png"
          : `test-results/12-backup-preview-${width}.png`,
      fullPage: false,
    });
  }
  await page.setViewportSize(viewport);
  await confirm().click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  const after = await demo();
  assert.equal(
    after.messages.filter((m) => m.id === "restore-message").length,
    1,
    "A demo backup restore must not silently drop message history",
  );
  assert.equal(after.settings.name, backup.settings.name);
  assert.equal(after.settings.weeklyGoal, 7);
  assert.equal(after.settings.voice, backup.settings.voice);
  assert.equal(after.settings.notifications, before.settings.notifications);
  assert.ok(after.settings.lastImportedAt);
  assert.equal(after.settings.lastImportCount, 1);
  assert.ok(after.circles.some((c) => c.id === "restore-circle"));
  await page.reload();
  await page
    .getByRole("button", { name: /Restore Test Person/ })
    .first()
    .click();
  await page.getByRole("tab", { name: /Conversation/ }).click();
  await page.getByText(backup.messages[0].text, { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  assert.deepEqual(await demo(), after);

  await upload(backup);
  await confirm().click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  const repeated = await demo();
  assert.equal(repeated.contacts.length, after.contacts.length);
  assert.equal(repeated.circles.length, after.circles.length);
  assert.equal(repeated.messages.length, after.messages.length);

  // A valid contact plus an orphan message must not partially update demo state.
  await upload({
    ...backup,
    contacts: [{ id: "rejected-person", name: "Rejected Test Person" }],
    messages: [{ id: "orphan", contactId: "missing", text: "Must reject" }],
  });
  await confirm().click();
  await page
    .getByRole("alert")
    .filter({ hasText: /Message 1 refers to a contact missing/ })
    .waitFor();
  assert.deepEqual(await demo(), repeated);
  await page.keyboard.press("Escape");
  assert.equal(
    await page.getByRole("button", { name: /Rejected Test Person/ }).count(),
    0,
  );

  // Saving to browser storage is the commit point, not a best-effort side effect.
  const quotaBackup = {
    ...backup,
    contacts: [{ id: "quota-person", name: "Quota Test Person" }],
    messages: [],
    circles: [],
    settings: { name: "Quota Tester", weeklyGoal: 9, voice: "Keep this retry" },
  };
  await upload(quotaBackup);
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && key === "rc-demo-v2")
        throw new DOMException("Synthetic quota failure", "QuotaExceededError");
      return set.call(this, key, value);
    };
    window.restoreDemoStorage = () => {
      Storage.prototype.setItem = set;
    };
  });
  await confirm().click();
  await page
    .getByRole("alert")
    .filter({ hasText: /This browser couldn't save the import/ })
    .waitFor();
  assert.deepEqual(await demo(), repeated);
  assert.equal(await page.getByRole("dialog").count(), 1);
  await page.evaluate(() => window.restoreDemoStorage());
  await confirm().click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  const recovered = await demo();
  assert.equal(
    recovered.contacts.filter((c) => c.id === "quota-person").length,
    1,
  );
  assert.equal(recovered.settings.name, "Quota Tester");
  await page.reload();
  await page
    .getByRole("button", { name: /Quota Test Person/ })
    .first()
    .waitFor();
  assert.deepEqual(await demo(), recovered);
  assert.deepEqual(
    await (await page.request.get(base + "/api/state")).json(),
    privateBefore,
  );
  assert.deepEqual(writes, [], "Demo import must make no private API writes");
  page.off("request", trackWrites);
  await page.evaluate(
    (value) => localStorage.setItem("rc-demo-v2", JSON.stringify(value)),
    before,
  );
  console.log(
    "Demo backup browser checks passed: complete restore, preview, reload persistence, repeat dedupe, orphan rejection, browser-storage failure/retry, and private-workspace isolation.",
  );
}
