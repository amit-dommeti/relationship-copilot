# V2 Release Checks

October 9, 2026. Checks apply to Relationship Copilot only.

- [x] Target user, core loop, and platform risk documented.
- [x] Isolated fictional demo and first-run empty state.
- [x] Desktop, tablet, and mobile route checks.
- [x] ZIP import, CSV parsing, repeat-import matching, saved drafts.
- [x] Circle creation, manual reply loop, calendar download.
- [x] Owner scoping, origin protection, expiring session tests.
- [x] Real screenshots captured; no real private data in fixtures.
- [x] Build produces Node client assets and a self-contained Worker.
- [x] Model requests mocked; no-key mode clearly labeled.
- [ ] Real-user archive import completed.
- [ ] Live model quality/latency evaluation completed.
- [ ] Screen-reader audit completed.
- [ ] Docker image executed on a production host.
- [ ] User outcome or retention experiment completed.

Publication is reported from the hosting tool's result, not inferred from this checklist. Server-side analytics are not enabled. The weekly count is based on messages the user marks sent, not verified LinkedIn delivery.

## Draft Recovery Checks - October 10, 2026

- [x] Original failed-save/copy regression reproduced before the fix.
- [x] 19 unit/integration tests pass, including five queue recovery/ordering tests and an isolated clean-build test.
- [x] Production client and Worker build pass.
- [x] Full Chromium browser suite passes with synthetic contacts and temporary storage.
- [x] Failed save, repeat failure, copy, navigation, explicit retry, reload warning, empty draft, and generated-starter recovery checked.
- [x] Desktop and mobile recovery controls visually reviewed; no status/word-count overlap.
- [x] Recovery screenshot contains only synthetic test data.
- [x] Stale build-output regression reproduced and fixed without changing applied SQL or database records.
- [ ] Other browser engines and assistive-technology behavior audited.

Unsaved drafts are retained only in the current tab. The unload warning is a browser safeguard, not crash recovery or guaranteed mobile protection.

## Draft Timing Checks - October 10, 2026

- [x] Newer-writing overwrite reproduced using a delayed simulated response.
- [x] 24 unit/integration tests pass, including five generation job-lifecycle tests.
- [x] Production build passes; existing save/import/reminder flows remain covered.
- [x] Browser checks cover newer typing/cursor, intent changes, duplicate requests, loading/error recovery, unrelated reply input, recorded sends, and workspace isolation.
- [x] Desktop/mobile loading-state captures reviewed with synthetic data only.
- [ ] Live model writing-quality, cost, or response-time evaluation performed.

These are application timing tests with simulated responses, not an AI quality evaluation.

## Import Safety Checks - October 10, 2026

- [x] Partial contact mutation reproduced before fixing malformed backup handling.
- [x] 31 unit/integration tests pass, including seven import safety tests.
- [x] Injected failure rolls back contacts, circles, messages, preferences, and import metadata.
- [x] Identity remapping, repeat restore, orphan rejection, and owner isolation checked.
- [x] Synthetic 10,000-contact import uses one batch with bounded parameters/query count.
- [x] Production build and full Chromium browser checks pass.
- [x] Previous preview removed on invalid selection; delayed file result cannot replace the latest selection.
- [x] Corrected backup restores successfully and persists after reload.
- [x] Desktop/mobile error captures reviewed; committed screenshot uses synthetic data only.
- [ ] Hosted D1 load/fault-injection testing performed.
- [ ] Simultaneous imports and editing from separate devices tested.
