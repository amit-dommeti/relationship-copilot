import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { demoState } from "../web/demo.js";

export async function checkReminderSafety(page, base) {
  const response = await page.request.post(base + "/api/contacts", {
    headers: { origin: base },
    data: { name: "Reminder Safety Person" },
  });
  assert.equal(response.status(), 201);
  const person = await response.json();
  const peerResponse = await page.request.post(base + "/api/contacts", {
    headers: { origin: base },
    data: { name: "Reminder Safety Peer" },
  });
  assert.equal(peerResponse.status(), 201);
  const peer = await peerResponse.json();
  await page.goto(base + "/#people");
  await page.reload();
  const open = async (contact = person, tab = "conversation") => {
    await page.getByLabel("Search people").fill(contact.name);
    await page
      .locator(`[data-action="person"][data-id="${contact.id}"]`)
      .click();
    if (tab === "conversation")
      await page.getByRole("tab", { name: /Conversation/ }).click();
  };
  await open();
  const field = page.getByLabel("When should we remind you?");
  const endpoint = `**/api/contacts/${person.id}`;
  const set = () =>
    page.getByRole("button", { name: "Set reminder", exact: true }).click();
  const clear = () =>
    page.getByRole("button", { name: "Clear", exact: true }).click();
  const settled = () =>
    page.locator('#reminder-form[aria-busy="false"]').waitFor();
  const stored = async (id = person.id) =>
    (await (await page.request.get(base + "/api/state")).json()).contacts.find(
      (c) => c.id === id,
    );
  const hold = async (predicate = () => true, fail = false) => {
    let release, reached;
    const gate = new Promise((resolve) => (release = resolve));
    const started = new Promise((resolve) => (reached = resolve));
    const jobs = [],
      requests = [];
    const handler = (route) => {
      const job = (async () => {
        const body = route.request().postDataJSON();
        requests.push(body);
        if (predicate(body)) {
          reached();
          await gate;
          if (fail)
            return route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ error: "Synthetic save failure" }),
            });
        }
        await route.continue();
      })();
      jobs.push(job);
      return job;
    };
    await page.route(endpoint, handler);
    return {
      release,
      started,
      requests,
      dispose: async () => {
        release();
        await Promise.all(jobs);
        await page.unroute(endpoint, handler);
      },
    };
  };
  const first = await hold();
  try {
    await field.fill("2027-12-01T10:30");
    await set();
    await first.started;
    assert.equal(
      await page
        .getByRole("button", { name: "Set reminder", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await page.evaluate(() => {
        const e = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(e);
        return e.defaultPrevented;
      }),
      true,
    );
    await page
      .locator("#reminder-form")
      .evaluate((form) => form.requestSubmit());
    await field.fill("2027-12-02T11:45");
    await page.getByLabel("Save a message").fill("Keep my reply and cursor.");
    await page
      .getByLabel("Save a message")
      .evaluate((el) => el.setSelectionRange(5, 12));
    first.release();
    await settled();
    assert.equal(
      await field.inputValue(),
      "2027-12-02T11:45",
      "A delayed reminder save must preserve a newer time",
    );
    assert.equal(first.requests.length, 1);
    assert.equal(
      await page
        .getByLabel("Save a message")
        .evaluate(
          (el) =>
            el === document.activeElement &&
            el.selectionStart === 5 &&
            el.selectionEnd === 12,
        ),
      true,
    );
    assert.equal(
      (await stored()).reminderAt,
      new Date("2027-12-01T10:30").toISOString(),
    );
    assert.match(
      await page.locator("#reminder-save-status").textContent(),
      /newer time still needs saving/,
    );
    await mkdir("test-results", { recursive: true });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await field.scrollIntoViewIfNeeded();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: `test-results/reminder-preserved-${width}.png`,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByLabel("Save a message").fill("");
  } finally {
    await first.dispose();
  }

  for (const clearing of [false, true]) {
    const failed = await hold(() => true, true);
    try {
      await (clearing ? clear() : set());
      await failed.started;
      failed.release();
      await settled();
      assert.match(
        await page.locator("#reminder-save-status").textContent(),
        /Save not confirmed/,
      );
      assert.equal(await field.inputValue(), "2027-12-02T11:45");
      assert.equal(
        (await stored()).reminderAt,
        new Date("2027-12-01T10:30").toISOString(),
      );
    } finally {
      await failed.dispose();
    }
  }
  await set();
  await settled();
  assert.equal(
    (await stored()).reminderAt,
    new Date("2027-12-02T11:45").toISOString(),
  );
  const clearing = await hold();
  try {
    await clear();
    await clearing.started;
    await field.fill("2027-12-03T12:00");
    clearing.release();
    await settled();
    assert.equal((await stored()).reminderAt, "");
    assert.equal(await field.inputValue(), "2027-12-03T12:00");
    assert.equal(
      await page.locator('[data-action="clear-reminder"]').isHidden(),
      true,
    );
  } finally {
    await clearing.dispose();
  }

  // A reopened drawer shares the in-flight lock and a late completion leaves other editors alone.
  for (const action of ["set", "clear"]) {
    const detached = await hold();
    try {
      await (action === "set" ? set() : clear());
      await detached.started;
      await page.keyboard.press("Escape");
      await open();
      assert.equal(
        await page
          .getByRole("button", { name: "Set reminder", exact: true })
          .isDisabled(),
        true,
      );
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", { name: "Explore demo", exact: true })
        .click();
      await page
        .getByText(
          "Wait for your reminder to finish saving before continuing.",
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
        .fill("Unrelated unsaved person");
      detached.release();
      await page.waitForFunction(() => {
        const e = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(e);
        return !e.defaultPrevented;
      });
      assert.equal(
        await page.getByLabel("Name", { exact: true }).inputValue(),
        "Unrelated unsaved person",
      );
      assert.equal(await page.locator("#app").evaluate((el) => el.inert), true);
      assert.equal(detached.requests.length, 1);
      await page.keyboard.press("Escape");
      await open();
      assert.equal(
        await field.inputValue(),
        action === "set" ? "2027-12-03T12:00" : "",
      );
    } finally {
      await detached.dispose();
    }
  }

  // Capture person and time before waiting for a different field's draft autosave.
  await page.keyboard.press("Escape");
  await open(person, "draft");
  const draft = await hold((body) => Object.hasOwn(body, "draft"));
  try {
    await page.locator("#draft-text").fill("A draft that saves slowly.");
    await draft.started;
    await page.getByRole("tab", { name: /Conversation/ }).click();
    await field.fill("2027-12-04T13:00");
    await set();
    await page.keyboard.press("Escape");
    await open(peer);
    await field.fill("2027-12-05T14:00");
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Add to calendar", exact: true })
      .click();
    const file = await download;
    const stream = await file.createReadStream();
    let contents = "";
    for await (const chunk of stream) contents += chunk;
    assert.match(contents, /Reminder Safety Peer/);
    assert.ok(
      contents.includes(
        new Date("2027-12-05T14:00")
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}/, ""),
      ),
    );
    draft.release();
    await page.waitForFunction(() => {
      const e = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(e);
      return !e.defaultPrevented;
    });
    assert.equal(
      (await stored()).reminderAt,
      new Date("2027-12-04T13:00").toISOString(),
    );
    assert.equal((await stored(peer.id)).reminderAt, "");
    assert.equal(await field.inputValue(), "2027-12-05T14:00");
    assert.equal(
      draft.requests.filter((body) => Object.hasOwn(body, "reminderAt")).length,
      1,
    );
  } finally {
    await draft.dispose();
  }
  await field.fill("2000-01-01T12:00");
  await set();
  await settled();
  assert.match(
    await page.locator("#reminder-save-status").textContent(),
    /Choose a time in the future/,
  );
  assert.equal((await stored(peer.id)).reminderAt, "");
  await page.keyboard.press("Escape");
  await page.goto(base + "/?demo=1#people");
  await page.evaluate(
    (seed) => localStorage.setItem("rc-demo-v2", JSON.stringify(seed)),
    demoState(),
  );
  await page.reload();
  await page.getByLabel("Search people").waitFor();
  const demoPerson = await page.evaluate(
    () => JSON.parse(localStorage.getItem("rc-demo-v2")).contacts[0],
  );
  let privateWrites = 0;
  const observe = (request) => {
    if (request.url().includes("/api/") && request.method() !== "GET")
      privateWrites++;
  };
  page.on("request", observe);
  const demoStored = () =>
    page.evaluate(
      (id) =>
        JSON.parse(localStorage.getItem("rc-demo-v2")).contacts.find(
          (c) => c.id === id,
        ).reminderAt,
      demoPerson.id,
    );
  try {
    await open(demoPerson);
    for (const clearing of [false, true]) {
      const before = await demoStored();
      await field.fill("2027-12-06T15:00");
      await page.evaluate(() => {
        window.originalReminderSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key === "rc-demo-v2")
            throw new DOMException(
              "Synthetic storage full",
              "QuotaExceededError",
            );
          return window.originalReminderSetItem.call(this, key, value);
        };
      });
      try {
        await (clearing ? clear() : set());
        await settled();
        assert.match(
          await page.locator("#reminder-save-status").textContent(),
          /Save not confirmed/,
        );
        assert.equal(await field.inputValue(), "2027-12-06T15:00");
        assert.equal(await demoStored(), before);
        await page.keyboard.press("Escape");
        await open(demoPerson);
        assert.equal(
          await field.inputValue(),
          before
            ? new Date(
                new Date(before).getTime() -
                  new Date(before).getTimezoneOffset() * 60000,
              )
                .toISOString()
                .slice(0, 16)
            : "",
        );
      } finally {
        await page.evaluate(() => {
          Storage.prototype.setItem = window.originalReminderSetItem;
          delete window.originalReminderSetItem;
        });
      }
      if (!clearing) await field.fill("2027-12-06T15:00");
      await (clearing ? clear() : set());
      await settled();
      assert.equal(
        await demoStored(),
        clearing ? "" : new Date("2027-12-06T15:00").toISOString(),
      );
    }
    await page.reload();
    await open(demoPerson);
    assert.equal(await field.inputValue(), "");
    assert.equal(
      privateWrites,
      0,
      "Demo reminder saves must never write to the private workspace",
    );
  } finally {
    page.off("request", observe);
  }
  await page.goto(base + "/#people");
  console.log(
    "Reminder browser checks passed: delayed save/clear, newer time and reply cursor, duplicate/reopen locks, failure/retry, unload/workspace guards, unrelated editors, pre-autosave identity, calendar download, past-time validation, and demo storage failure/retry/isolation.",
  );
}
