import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { zipSync, strToU8 } from "fflate";
import { checkDraftGeneration } from "./draft-generation-browser.mjs";
import { checkImportSafety } from "./import-safety-browser.mjs";
import { checkReplyBuffer } from "./reply-buffer-browser.mjs";

const socket = createServer();
await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const dir = await mkdtemp(`${tmpdir()}/copilot-test-`);
const child = spawn(process.execPath, ["server/node.mjs"], {
  env: {
    ...process.env,
    PORT: String(port),
    DATA_DIR: dir,
    NODE_ENV: "test",
    OPENAI_API_KEY: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", (b) => (output += b));
child.stderr.on("data", (b) => (output += b));
const base = `http://localhost:${port}`,
  shots = process.env.UPDATE_SCREENSHOTS
    ? "assets/screenshots/v2"
    : "test-results";
await mkdir(shots, { recursive: true });
let browser;
try {
  for (let n = 0; n < 100; n++) {
    if (output.includes("Relationship Copilot:")) break;
    if (child.exitCode !== null) throw new Error(output);
    await new Promise((r) => setTimeout(r, 50));
  }
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/?demo=1");
  await page
    .getByRole("heading", { name: "A little closer, one hello at a time." })
    .waitFor();
  const shot = async (name) =>
    page.screenshot({
      path: `${shots}/${name}.png`,
      fullPage: name !== "04-composer",
    });
  await shot("01-today");
  for (const [route, name] of [
    ["people", "02-people"],
    ["circles", "03-circles"],
    ["inbox", "05-inbox"],
    ["connections", "06-import"],
  ]) {
    await page.locator(`nav a[href="#${route}"]`).click();
    await page.waitForTimeout(80);
    await shot(name);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `${route} desktop overflow`,
    );
  }
  await page.locator('nav a[href="#today"]').click();
  await page
    .getByRole("button", { name: "Say hello", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Help me start", exact: true })
    .click();
  await page.waitForFunction(() =>
    document.querySelector("#draft-text")?.value.startsWith("Hi Maya"),
  );
  await shot("04-composer");
  await page
    .getByLabel("Message draft")
    .fill(
      "Hi Maya, remember our Friday project reviews? How have things been?",
    );
  await page.getByRole("button", { name: "I sent it", exact: true }).click();
  await page.locator('[role="dialog"]').waitFor({ state: "detached" });
  await page.locator('nav a[href="#people"]').click();
  await page.getByLabel("Search people").fill("Maya");
  await page.locator('#people-results [data-action="person"]').click();
  assert.equal(await page.getByLabel("Message draft").inputValue(), "");
  await page.getByRole("tab", { name: /Conversation/ }).click();
  await page
    .getByLabel("Save a message")
    .fill("Good to hear from you. Coffee next week?");
  await page.getByRole("button", { name: "Save message", exact: true }).click();
  await page
    .getByRole("button", { name: "No reply needed", exact: true })
    .waitFor();
  await page.getByLabel("When should we remind you?").fill("2027-12-01T10:30");
  await page.getByRole("button", { name: "Set reminder", exact: true }).click();
  await page.waitForTimeout(100);
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Add to calendar", exact: true })
    .click();
  assert.equal((await downloadPromise).suggestedFilename(), "catch-up.ics");
  await page.keyboard.press("Escape");
  await page.locator('nav a[href="#circles"]').click();
  await page.getByRole("button", { name: "New circle", exact: true }).click();
  await page.getByLabel("Circle name").fill("Test teammates");
  await page
    .getByLabel("What connects you?")
    .fill("We shipped the onboarding experiment.");
  await page.getByRole("button", { name: "Save circle", exact: true }).click();
  await page
    .getByRole("heading", { name: "Test teammates", exact: true })
    .waitFor();

  // The real workspace remains empty after an entire demo session.
  await page.getByRole("button", { name: "Leave demo", exact: true }).click();
  await page
    .getByRole("button", { name: "Add your first person", exact: true })
    .waitFor();
  assert.equal(
    (await (await page.request.get(base + "/api/state")).json()).contacts
      .length,
    0,
  );
  await page
    .getByRole("button", { name: "Import your contacts", exact: true })
    .click();
  const csv =
    "First Name,Last Name,URL,Company,Position\nTest,Person,https://www.linkedin.com/in/test-person,Square,PM";
  await page.locator("#import-file").setInputFiles({
    name: "linkedin.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(zipSync({ "Connections.csv": strToU8(csv) })),
  });
  await page
    .getByRole("button", { name: "Import contacts", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Test Person/ })
    .first()
    .waitFor();
  await page.reload();
  await page
    .getByRole("button", { name: /Test Person/ })
    .first()
    .waitFor();
  await page
    .getByRole("button", { name: /Test Person/ })
    .first()
    .click();
  await page.getByLabel("Message draft").fill("Hi Test, saved across reloads.");
  await page.waitForTimeout(650);
  await page.reload();
  await page
    .getByRole("button", { name: /Test Person/ })
    .first()
    .click();
  assert.equal(
    await page.getByLabel("Message draft").inputValue(),
    "Hi Test, saved across reloads.",
  );
  // A failed autosave must never block copying the text still in the editor.
  const failDraftSave = (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Test save outage" }),
        })
      : route.continue();
  await page.route("**/api/contacts/*", failDraftSave);
  await page.evaluate(() => {
    window.copiedDraft = null;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value) => (window.copiedDraft = value) },
    });
  });
  const unsavedDraft = "Hi Test, can we catch up after your launch?";
  await page.getByLabel("Message draft").fill(unsavedDraft);
  await page.waitForFunction(() =>
    document.querySelector("#draft-saved")?.textContent.includes("Not saved"),
  );
  await page.getByRole("button", { name: "Copy message", exact: true }).click();
  assert.equal(await page.evaluate(() => window.copiedDraft), unsavedDraft);
  await page
    .getByRole("button", { name: "Retry saving draft", exact: true })
    .click();
  await page.waitForFunction(() =>
    document.querySelector("#draft-saved")?.textContent.includes("Not saved"),
  );
  await page.getByRole("tab", { name: "Relationship", exact: true }).click();
  await page.getByRole("tab", { name: "Write a hello", exact: true }).click();
  assert.match(await page.locator("#draft-saved").innerText(), /Not saved/);
  await page.getByRole("button", { name: "Close detail", exact: true }).click();
  await page
    .getByRole("button", { name: /Test Person/ })
    .first()
    .click();
  assert.equal(
    await page.getByLabel("Message draft").inputValue(),
    unsavedDraft,
  );
  assert.match(await page.locator("#draft-saved").innerText(), /Not saved/);
  await page.screenshot({
    path: process.env.UPDATE_RECOVERY_SCREENSHOT
      ? "assets/screenshots/v2/08-draft-recovery.png"
      : "test-results/08-draft-recovery.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Retry saving draft", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/08-draft-recovery-mobile.png" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  const saveState = await page.locator(".draft-save-state").boundingBox();
  const wordCount = await page.locator("#word-count").boundingBox();
  assert.ok(
    saveState.x + saveState.width <= wordCount.x,
    "Save status overlaps word count",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });

  const warning = page.waitForEvent("dialog");
  const blockedReload = page.reload().catch(() => {});
  const dialog = await warning;
  assert.equal(dialog.type(), "beforeunload");
  await dialog.dismiss();
  await blockedReload;
  assert.equal(
    await page.getByLabel("Message draft").inputValue(),
    unsavedDraft,
  );
  await page.unroute("**/api/contacts/*", failDraftSave);
  await page
    .getByRole("button", { name: "Retry saving draft", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelector("#draft-saved")?.textContent === "Draft saved",
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Retry saving draft", exact: true })
      .isVisible(),
    false,
  );
  // No reload warning after recovery, and the exact draft survives the reload.
  await page.reload();
  await page
    .getByRole("button", { name: /Test Person/ })
    .first()
    .click();
  assert.equal(
    await page.getByLabel("Message draft").inputValue(),
    unsavedDraft,
  );
  // Clearing a draft is also an edit that must survive a reload.
  const cleared = page.waitForResponse(
    (response) =>
      response.url().includes("/api/contacts/") &&
      response.request().method() === "PATCH",
  );
  await page.getByLabel("Message draft").fill("");
  assert.equal((await cleared).status(), 200);
  await page.waitForFunction(
    () =>
      document.querySelector("#draft-saved")?.textContent ===
      "Only you can send this",
  );
  await page.reload();
  await page
    .getByRole("button", { name: /Test Person/ })
    .first()
    .click();
  assert.equal(await page.getByLabel("Message draft").inputValue(), "");
  // Generated starters use the same recovery path, not an untracked write.
  await page.route("**/api/contacts/*", failDraftSave);
  await page
    .getByRole("button", { name: "Help me start", exact: true })
    .click();
  await page.waitForFunction(() =>
    document.querySelector("#draft-saved")?.textContent.includes("Not saved"),
  );
  assert.match(await page.getByLabel("Message draft").inputValue(), /^Hi Test/);
  await page.unroute("**/api/contacts/*", failDraftSave);
  await page
    .getByRole("button", { name: "Retry saving draft", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelector("#draft-saved")?.textContent === "Draft saved",
  );
  assert.equal(
    await page
      .getByLabel("Message draft")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.locator("#import-file").setInputFiles({
    name: "Connections.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page
    .getByRole("button", { name: "Import contacts", exact: true })
    .click();
  await page.waitForTimeout(150);
  assert.equal(
    (await (await page.request.get(base + "/api/state")).json()).contacts
      .length,
    1,
  );

  await checkDraftGeneration(page, base);
  await checkImportSafety(page, base, shots);
  await checkReplyBuffer(page, base, shots);
  await page.goto(base + "/?demo=1#today");
  await page
    .getByRole("heading", { name: "A little closer, one hello at a time." })
    .waitFor();
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of [
      "today",
      "people",
      "circles",
      "inbox",
      "connections",
      "settings",
    ]) {
      await page.evaluate((route) => (location.hash = route), route);
      await page.waitForTimeout(60);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `${route} ${width}px overflow`,
      );
      if (width === 390 && route === "today") await shot("07-mobile");
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => (location.hash = "today"));
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page.locator('nav a[href="#inbox"]').click();
  await page
    .getByRole("heading", { name: "Pick up the conversation" })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: six routes at desktop/tablet/mobile, drafts, failed-save copying/retry/navigation, unsaved reload warning, empty-draft persistence, reply loop, circles, ZIP import, dedupe, persistence, demo isolation, calendar download.",
  );
} finally {
  await browser?.close();
  const stopped = new Promise((r) => child.once("exit", r));
  child.kill("SIGTERM");
  await stopped;
  await rm(dir, { recursive: true, force: true });
}
