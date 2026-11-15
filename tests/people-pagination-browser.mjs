import assert from "node:assert/strict";

export async function checkPeoplePagination(page, base) {
  const contacts = Array.from({ length: 61 }, (_, index) => ({
    name: `Page Boundary ${String(index + 1).padStart(2, "0")}`,
    company: index < 31 ? "Thirty Crew" : "Sixty Crew",
    role: "Import Boundary",
    email: `page-boundary-${index + 1}@example.test`,
  }));
  const seeded = await page.request.post(base + "/api/import", {
    headers: { origin: base },
    data: { contacts },
  });
  assert.equal(seeded.status(), 200);
  await page.goto(base + "/#people");
  await page.reload();
  const search = page.getByLabel("Search people");
  const rows = page.locator('#people-results [data-action="person"]');
  const next = page.getByRole("button", { name: "Next page", exact: true });
  const previous = page.getByRole("button", {
    name: "Previous page",
    exact: true,
  });
  const archiveLast = async () => {
    await rows.last().click();
    await page.getByRole("tab", { name: "Relationship", exact: true }).click();
    await page
      .getByRole("button", { name: "Archive person", exact: true })
      .click();
    await page.locator('[role="dialog"]').waitFor({ state: "detached" });
  };

  // Losing page three should land on page two, not an empty page or the beginning.
  await search.fill("Page Boundary");
  await next.click();
  await next.click();
  assert.equal(await rows.count(), 1);
  await archiveLast();
  assert.equal(
    await rows.count(),
    30,
    "When the last page disappears, remaining people must still be reachable",
  );
  assert.equal(
    await rows.first().getByText("Page Boundary 31", { exact: true }).count(),
    1,
  );
  assert.equal(await previous.isEnabled(), true);
  assert.equal(await next.isDisabled(), true);
  await page
    .locator(".table-foot")
    .getByText("2 / 2", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page
    .locator(".table-foot")
    .getByText("2 / 3", { exact: true })
    .waitFor();
  assert.equal(
    await rows.count(),
    30,
    "Adding a page must not move the current valid page",
  );

  // At 31 -> 30, the old bug also removed the only way back to page one.
  await search.fill("Thirty Crew");
  await next.click();
  assert.equal(await rows.count(), 1);
  await archiveLast();
  assert.equal(await rows.count(), 30);
  assert.equal(await next.count(), 0);
  assert.equal(await previous.count(), 0);
  assert.equal(await search.inputValue(), "Thirty Crew");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await next.waitFor();
  assert.equal(await rows.count(), 30);
  await next.click();

  // An edit can shrink search results just as an archive can.
  await rows.first().click();
  await page.getByRole("button", { name: "Edit person", exact: true }).click();
  await page.getByLabel("Current company", { exact: true }).fill("Moved Crew");
  await page.getByRole("button", { name: "Save person", exact: true }).click();
  await page.locator("#person-form").waitFor({ state: "detached" });
  assert.equal(await rows.count(), 30);
  assert.equal(await search.inputValue(), "Thirty Crew");
  const viewport = page.viewportSize();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await search.scrollIntoViewIfNeeded();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `test-results/people-pagination-${width}.png`,
    });
  }
  await page.setViewportSize(viewport);

  // An empty search stays empty, and clearing it returns to a valid first page.
  await search.fill("No matching boundary person");
  await page
    .getByRole("heading", { name: "No people here yet", exact: true })
    .waitFor();
  assert.equal(await rows.count(), 0);
  assert.equal(await next.count(), 0);
  await search.fill("Page Boundary");
  assert.equal(await rows.count(), 30);
  assert.equal(await previous.isDisabled(), true);

  // A dismissed import updates results in place, so it needs the same boundary rule.
  await search.fill("Import Boundary");
  await next.click();
  await next.click();
  assert.equal(await rows.count(), 1);
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.locator("#import-file").setInputFiles({
    name: "Connections.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Name,Email,Company,Role\nPage Boundary 61,page-boundary-61@example.test,Sixty Crew,Outside query",
    ),
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
    await search.focus();
    await search.evaluate((el) => el.setSelectionRange(0, 4));
    release();
    await page
      .locator(".table-foot")
      .getByText("2 / 2", { exact: true })
      .waitFor();
    assert.equal(await rows.count(), 30);
    assert.equal(
      await rows.first().getByText("Page Boundary 31", { exact: true }).count(),
      1,
    );
    assert.deepEqual(
      await search.evaluate((el) => [
        el.value,
        el === document.activeElement,
        el.selectionStart,
        el.selectionEnd,
      ]),
      ["Import Boundary", true, 0, 4],
    );
    assert.equal(await next.isDisabled(), true);
  } finally {
    release();
    await held;
    await page.unroute("**/api/import", hold);
  }
  await search.fill("Outside query");
  assert.equal(await rows.count(), 1);
  await archiveLast();
  await page
    .getByRole("heading", { name: "No people here yet", exact: true })
    .waitFor();
  assert.equal(await next.count(), 0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page
    .locator(".table-foot")
    .getByText("1 person", { exact: true })
    .waitFor();
  assert.equal(
    await rows.count(),
    1,
    "Undo after an empty result must recover the first page",
  );
  const state = await (await page.request.get(base + "/api/state")).json();
  assert.equal(
    state.contacts.filter((c) => c.email.startsWith("page-boundary-")).length,
    61,
    "Navigation recovery must not remove any contacts",
  );
  console.log(
    "People pagination checks passed: 61-to-60 and 31-to-30 archive recovery, valid-page retention after Undo, result shrink after edits and dismissed imports, preserved search/cursor, empty search recovery, and desktop/mobile framing.",
  );
}
