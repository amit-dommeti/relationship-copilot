import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { demoState } from "../web/demo.js";

export async function checkKeyboardNavigation(page, base) {
  await page.goto(base + "/?demo=1#people");
  await page.evaluate(
    (seed) => localStorage.setItem("rc-demo-v2", JSON.stringify(seed)),
    demoState(),
  );
  await page.reload();
  const person = page.locator('#people-results [data-action="person"]').first();
  await person.waitFor();
  await person.focus();
  await page.keyboard.press("Enter");
  const conversation = page.getByRole("tab", { name: /Conversation/ });
  await conversation.focus();
  await page.keyboard.press("Enter");
  assert.equal(
    await conversation.evaluate((tab) => tab === document.activeElement),
    true,
    "Activating a contact tab must keep keyboard focus on that tab",
  );
  const focusedTab = (id) =>
    page.waitForFunction((value) => {
      const active = document.querySelector(
        '[role="tab"][aria-selected="true"]',
      );
      return active?.dataset.id === value && active === document.activeElement;
    }, id);
  const checkLinks = async (selected) => {
    assert.deepEqual(
      await page.getByRole("tab").evaluateAll((tabs) =>
        tabs.map((tab) => {
          const panel = document.getElementById(
            tab.getAttribute("aria-controls"),
          );
          return {
            linked: panel?.getAttribute("aria-labelledby") === tab.id,
            active: tab.getAttribute("aria-selected") === "true",
            tabbable: tab.tabIndex === 0,
            visible: Boolean(panel?.getClientRects().length),
          };
        }),
      ),
      ["draft", "conversation", "about"].map((id) => ({
        linked: true,
        active: id === selected,
        tabbable: id === selected,
        visible: id === selected,
      })),
    );
  };
  for (const [key, id] of [
    ["ArrowRight", "about"],
    ["ArrowRight", "draft"],
    ["ArrowLeft", "about"],
    ["Home", "draft"],
    ["End", "about"],
    ["ArrowLeft", "conversation"],
  ]) {
    await page.keyboard.press(key);
    await focusedTab(id);
    await checkLinks(id);
  }
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .getByRole("tabpanel")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("Tab");
  const reply = page.getByLabel("Save a message");
  assert.equal(
    await reply.evaluate((el) => el === document.activeElement),
    true,
  );
  await reply.fill("Keyboard-only reply in progress.");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Home");
  assert.equal(
    await conversation.getAttribute("aria-selected"),
    "true",
    "Text navigation must not switch tabs",
  );
  const time = page.getByLabel("When should we remind you?");
  await time.fill("2027-12-08T10:30");
  await conversation.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await focusedTab("conversation");
  assert.equal(
    await time.inputValue(),
    "2027-12-08T10:30",
    "Activating the already active tab must not redraw unsaved controls",
  );
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await reply.inputValue(), "Keyboard-only reply in progress.");
  await reply.fill("");

  // Both ends of each panel wrap inside the drawer; inactive tabs/panels are skipped.
  for (const id of ["draft", "conversation", "about"]) {
    await page.locator(`#contact-tab-${id}`).click();
    const first = page.locator('.detail-top button[data-action="favorite"]');
    await first.focus();
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page.evaluate(() => {
        const active = document.activeElement;
        return (
          document.getElementById("overlay").contains(active) &&
          !active.closest("[hidden]") &&
          !active.matches(":disabled")
        );
      }),
      true,
    );
    const last = await page.evaluate(
      () => document.activeElement.dataset.action,
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await first.evaluate((el) => el === document.activeElement),
      true,
    );
    assert.notEqual(last, "detail-tab");
  }
  // Recover if a redraw removes the previously focused control.
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator('.detail-top button[data-action="favorite"]')
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page
      .getByRole("button", { name: "Archive person", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );

  await page.keyboard.press("Escape");
  assert.equal(
    await person.evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Edit person", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: "Edit relationship" }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(
    await person.evaluate((el) => el === document.activeElement),
    true,
    "Replacement dialogs must retain the original page opener",
  );

  // A saved change rerenders the page, so return to the matching current person control.
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Mark as close connection", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove from close connections", exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  assert.equal(
    await person.evaluate((el) => el === document.activeElement),
    true,
  );
  const search = page.getByLabel("Search people");
  await search.focus();
  await page.keyboard.press("Escape");
  assert.equal(
    await search.evaluate((el) => el === document.activeElement),
    true,
    "Escape outside a dialog must not steal focus",
  );

  // Replacing the import dialog with its paste mode retains its page opener too.
  const importer = page.getByRole("button", { name: "Import", exact: true });
  await importer.focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Paste rows instead", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Paste CSV or spreadsheet rows").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(
    await importer.evaluate((el) => el === document.activeElement),
    true,
  );

  // Focus indicators and linked-panel layout remain visible on desktop and mobile.
  await person.click();
  await page.getByRole("tab", { name: "Relationship", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await mkdir("test-results", { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.equal(
      await page
        .getByRole("tabpanel")
        .evaluate((el) => getComputedStyle(el).outlineStyle),
      "solid",
    );
    await page.screenshot({ path: `test-results/keyboard-panel-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Archive person", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal(
    await page
      .locator("#main h1")
      .evaluate((el) => el === document.activeElement),
    true,
    "A removed opener should fall back to the page heading",
  );

  // A real pending circle save disables fields but must not break Tab containment.
  for (let n = 0; n < 8; n++) {
    const created = await page.request.post(base + "/api/contacts", {
      headers: { origin: base },
      data: { name: `Keyboard Scroll Person ${n}` },
    });
    assert.equal(created.status(), 201);
  }
  await page.goto(base + "/#circles");
  const newCircle = page.getByRole("button", {
    name: "New circle",
    exact: true,
  });
  await newCircle.focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Circle name").fill("Keyboard Pending Circle");
  let release, reached, job;
  const gate = new Promise((resolve) => (release = resolve));
  const started = new Promise((resolve) => (reached = resolve));
  const endpoint = "**/api/circles";
  const handler = (route) => {
    job = (async () => {
      reached();
      await gate;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Synthetic save failure" }),
      });
    })();
    return job;
  };
  await page.route(endpoint, handler);
  try {
    await page
      .getByRole("button", { name: "Save circle", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await started;
    assert.equal(
      await page.getByLabel("What connects you?").isDisabled(),
      true,
    );
    for (const key of ["Tab", "Tab", "Shift+Tab", "Shift+Tab", "Tab"]) {
      await page.keyboard.press(key);
      assert.equal(
        await page.evaluate(() => {
          const el = document.activeElement;
          return (
            el.closest('[role="dialog"]') !== null &&
            (el.dataset.action === "close" || el.id === "circle-members") &&
            !el.matches(":disabled")
          );
        }),
        true,
        "Pending form focus must stay on enabled dialog controls or its scrollable member list",
      );
    }
    await page.getByRole("button", { name: "Close", exact: true }).focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .locator("#circle-members")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("End");
    await page.waitForFunction(
      () => document.getElementById("circle-members").scrollTop > 0,
    );
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator("#circle-members").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `test-results/keyboard-circle-${width}.png`,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .getByRole("button", { name: "Cancel", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
      "A scroll region must not reset focus to the start of the dialog",
    );
    release();
    await page.locator('#circle-form[aria-busy="false"]').waitFor();
    assert.equal(await page.getByLabel("Circle name").isEnabled(), true);
  } finally {
    release();
    await job;
    await page.unroute(endpoint, handler);
  }
  await page.keyboard.press("Escape");
  assert.equal(
    await newCircle.evaluate((el) => el === document.activeElement),
    true,
  );
  await page.locator('nav a[href="#people"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () =>
      document.activeElement === document.querySelector("#main h1") &&
      location.hash === "#people",
  );
  console.log(
    "Keyboard browser checks passed: tab activation/focus, arrow wrapping, Home/End, roving focus, linked visible panels, text-field keys, active-tab input preservation, Tab containment/recovery, nested-dialog return, rerendered/missing opener, import/paste return, pending disabled controls, and desktop/mobile focus indicators.",
  );
}

export async function checkDelayedOpener(page, base) {
  const response = await page.request.post(base + "/api/contacts", {
    headers: { origin: base },
    data: { name: "Keyboard Slow Draft Person" },
  });
  assert.equal(response.status(), 201);
  const person = await response.json();
  await page.goto(base + "/#people");
  await page.reload();
  await page.getByLabel("Search people").fill(person.name);
  await page.locator(`[data-action="person"][data-id="${person.id}"]`).click();
  let release, reached, job;
  const gate = new Promise((resolve) => (release = resolve));
  const started = new Promise((resolve) => (reached = resolve));
  const endpoint = `**/api/contacts/${person.id}`;
  const hold = (route) => {
    job = (async () => {
      reached();
      await gate;
      await route.continue();
    })();
    return job;
  };
  await page.route(endpoint, hold);
  try {
    await page
      .getByLabel("Message draft", { exact: true })
      .fill("A slow saved draft.");
    await started;
    await page.keyboard.press("Escape");
    const importer = page.getByRole("button", { name: "Import", exact: true });
    await importer.focus();
    await page.keyboard.press("Enter");
    assert.equal(await importer.isDisabled(), true);
    await page.getByLabel("Search people").focus();
    release();
    await page.getByLabel("Choose contact file").waitFor();
    await page.keyboard.press("Escape");
    assert.equal(
      await importer.evaluate((el) => el === document.activeElement),
      true,
      "Delayed opening must return to the clicked opener, not a field focused while waiting",
    );
  } finally {
    release();
    await job;
    await page.unroute(endpoint, hold);
  }
  console.log(
    "Delayed-opener check passed: dialog return target is captured before draft saving and focus changes.",
  );
}

export async function checkRouteFocus(page, base) {
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto(base + "/?demo=1#settings");
  await page
    .getByRole("heading", { name: "Make it yours", exact: true })
    .waitFor();
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  assert.ok(await page.evaluate(() => window.scrollY > 0));
  await page.locator('nav a[href="#people"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () =>
      location.hash === "#people" &&
      document.activeElement === document.querySelector("#main h1"),
  );
  assert.equal(
    await page.locator("#main h1").evaluate((el) => {
      const box = el.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= innerHeight;
    }),
    true,
    "Keyboard route focus must be visible, not above the retained page scroll position",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  console.log(
    "Route-focus browser check passed: navigation brings the focused heading into view from a scrolled page.",
  );
}
