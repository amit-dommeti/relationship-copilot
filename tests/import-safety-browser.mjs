import assert from "node:assert/strict";

export async function checkImportSafety(page, base, shots) {
  await page.goto(base + "/#people");
  const openImport = page.getByRole("button", { name: "Import", exact: true });
  await openImport.waitFor();
  const snapshot = async () =>
    (await page.request.get(base + "/api/state")).json();
  const before = await snapshot();
  const contact = before.contacts[0];
  const backup = {
    contacts: [{ ...contact, company: "Restored Test Company" }],
    circles: [{ id: "restored-circle", name: "Test alumni" }],
    messages: [
      {
        id: "restored-message",
        contactId: contact.id,
        text: "A saved test conversation",
        direction: "in",
        at: "2025-01-01T12:00:00Z",
      },
    ],
    settings: { ...before.settings, name: "Test Owner" },
  };
  const file = (data, name = "copilot-backup.json") => ({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await openImport.click();
  const input = page.locator("#import-file");
  const confirm = page.getByRole("button", {
    name: "Restore backup",
    exact: true,
  });
  await input.setInputFiles(file(backup));
  await confirm.waitFor();
  await input.setInputFiles(
    file(
      { ...backup, messages: [{ contactId: {}, text: "Hello" }] },
      "broken-backup.json",
    ),
  );
  await page
    .getByRole("alert")
    .filter({ hasText: "Message 1 needs a valid contact ID" })
    .waitFor();
  assert.equal(
    await confirm.count(),
    0,
    "a rejected file must remove the previous confirmation",
  );
  assert.deepEqual(await snapshot(), before);
  await page.locator("#toast .toast").waitFor({ state: "detached" });
  await page.screenshot({
    path: `${process.env.UPDATE_IMPORT_SCREENSHOT ? "assets/screenshots/v2" : shots}/10-import-safety.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: "test-results/import-safety-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });

  // A late file read must not replace the most recently selected file.
  await page.evaluate(() => {
    const read = File.prototype.text;
    File.prototype.text = function () {
      if (this.name === "slow-backup.json")
        return new Promise((resolve) => {
          window.finishImportRead = () => resolve(read.call(this));
        });
      return read.call(this);
    };
    window.restoreFileRead = () => {
      File.prototype.text = read;
    };
  });
  await input.setInputFiles(
    file({ contacts: [{ name: "Outdated File Person" }] }, "slow-backup.json"),
  );
  await page
    .getByRole("status")
    .filter({ hasText: "Checking your file" })
    .waitFor();
  assert.equal(await confirm.count(), 0);
  await input.setInputFiles(file(backup));
  await confirm.waitFor();
  await page.evaluate(async () => {
    window.finishImportRead();
    window.restoreFileRead();
  });
  await page.waitForTimeout(100);
  assert.equal(
    await page
      .locator("#import-preview")
      .getByText("Outdated File Person")
      .count(),
    0,
  );

  // Referential validation also runs on the server, against this owner's workspace.
  await input.setInputFiles(
    file({
      ...backup,
      messages: [{ contactId: "missing-person", text: "Hello" }],
    }),
  );
  const rejected = page.waitForResponse(
    (r) => r.url().endsWith("/api/import") && r.request().method() === "POST",
  );
  await confirm.click();
  assert.equal((await rejected).status(), 400);
  await page.getByText(/Message 1 refers to a contact missing/).waitFor();
  assert.deepEqual(await snapshot(), before);

  await input.setInputFiles(file(backup));
  const saved = page.waitForResponse(
    (r) => r.url().endsWith("/api/import") && r.request().method() === "POST",
  );
  await confirm.click();
  assert.equal((await saved).status(), 200);
  await page.locator('[role="dialog"]').waitFor({ state: "detached" });
  await page.reload();
  await openImport.waitFor();
  const after = await snapshot();
  const restored = after.contacts.find((c) => c.id === contact.id);
  assert.equal(restored.company, "Restored Test Company");
  assert.equal(restored.memory, contact.memory);
  assert.equal(restored.draft, contact.draft);
  assert.ok(after.circles.some((c) => c.id === "restored-circle"));
  assert.ok(after.messages.some((m) => m.id === "restored-message"));
  assert.equal(after.settings.name, "Test Owner");
  console.log(
    "Import browser checks passed: invalid-file replacement, late-file isolation, unchanged workspace after rejection, full-backup retry/persistence, desktop/mobile error state.",
  );
}
