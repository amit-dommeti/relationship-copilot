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

## Reply Entry Checks - October 10, 2026

- [x] Unsaved reply erased by setting a reminder reproduced before the fix.
- [x] 37 unit/integration tests pass, including six reply-buffer tests.
- [x] Production build and full Chromium core-journey checks pass.
- [x] Reply text/direction survive reminder changes, tabs, closing/reopening, and visiting another person.
- [x] Duplicate submissions blocked while pending, including after reopening the drawer.
- [x] Failed save retains text; successful retry clears only acknowledged, unchanged input.
- [x] Slow save preserves newer text/cursor and another person's entry.
- [x] Unload warning and explicit workspace-switch guard checked.
- [x] Desktop/mobile failure-state captures visually reviewed with synthetic data.
- [ ] Lost-acknowledgement retry is exactly-once.
- [ ] Other form types have the same unsaved-entry protection.

Reply buffers exist only in the current tab and require an explicit save. They are not crash recovery, inbox sync, or automatic sending.

## Message Retry Checks - October 10, 2026

- [x] Duplicate recording reproduced before implementing the save-identity contract.
- [x] 48 unit/integration tests pass, including eleven new retry tests.
- [x] Matching retries return the original record/timestamp; conflicting reuse rejects without state changes.
- [x] Local concurrent calls, owner isolation, invalid identities, legacy clients, and insert-failure rollback checked.
- [x] Production build and full Chromium core-journey suite pass.
- [x] Browser drops an acknowledgement after the actual local write, then verifies one record after retry.
- [x] Failed state refresh, intentional repeated text, later state preservation, and manually recorded send retries checked.
- [x] Applied migrations, Site identity, and private audience unchanged.
- [ ] Retained retry identity across reloads/devices implemented.
- [ ] Production D1 fault-injection/load test performed.

The prior reply iteration's lost-acknowledgement gap is now covered for retained request identities. This is not a universal exactly-once guarantee or an outbound messaging integration.

## Sent Draft Checks - October 10, 2026

- [x] Delayed recorded send erasing newer saved writing reproduced before the fix.
- [x] 49 unit/integration tests and production build pass.
- [x] Full Chromium core-journey suite passes; focused send-timing check also passes independently.
- [x] Newer draft, cursor/focus, and text edited back to its original value preserved.
- [x] Pending lock survives reopening; duplicate action blocked.
- [x] Click-time person/text captured before autosave; other people's drawers and Conversation input remain intact.
- [x] Typing during cleanup and lost acknowledgement after an actual local write checked.
- [x] Desktop/mobile pending-state captures inspected; no overflow or overlapping controls.
- [x] Existing Site identity, private audience, API contract, and migrations unchanged.
- [ ] Atomic preservation across forced shutdown or simultaneous clients implemented.

The follow-up draft save uses existing recovery behavior. No external message, live model evaluation, or real-user data was used.

## Complete Demo Restore Checks - October 11, 2026

- [x] Demo restore silently dropping message history reproduced before the fix.
- [x] 54 unit/integration tests and production build pass.
- [x] Demo/server restore parity covers contact mapping, preserved relationship state, circles, history, preferences, and notifications.
- [x] Existing private import rollback, owner isolation, and bounded 10,000-contact checks remain passing.
- [x] Full Chromium core-journey suite passes across desktop/tablet/mobile.
- [x] Focused restore check verifies reload persistence, repeat deduplication, orphan rejection, storage-failure retry, and no private API writes.
- [x] Backup summary and demo-only destination inspected on desktop/mobile; new committed screenshot uses synthetic data only.
- [x] Import errors persist in the dialog and are not duplicated in transient notices.
- [x] Existing Site identity, owner-private access, migrations, and AI configuration unchanged.
- [ ] Browser eviction and cross-tab conflict recovery implemented.
- [ ] Production D1 fault/load testing or a real-user backup experiment performed.

Demo import is browser-local, not a cloud backup. Other demo editing flows retain their existing save behavior.

## Conditional Draft Clear Checks - October 11, 2026

- [x] Storage-side newer-draft loss reproduced before implementing the conditional clear.
- [x] 60 unit/integration tests and production build pass.
- [x] Clear requires the matching saved version and text; identical-text saves invalidate older permission.
- [x] Optional/legacy guard, malformed input, replay, historical-event, and transaction rollback cases checked.
- [x] Retry retains its original guard and identity.
- [x] Initial conditional-clear implementation passed the full Chromium suite across desktop/tablet/mobile.
- [x] Final focused sent-draft checks pass, including the reviewed delayed-refresh/metadata-save/next-send case.
- [x] Final full Chromium core-journey suite passes twice consecutively after the review fix. Earlier timeout history and diagnostics retained; assertions/time limits unchanged.
- [x] Browser verifies durability before acknowledgement and after a lost confirmation, with repair writes blocked.
- [x] A completed save from a simulated second client survives delayed recording and is displayed without cleanup overwrites.
- [x] Separate outgoing history preserves the composer across reload.
- [x] Synthetic desktop/mobile pending-recording captures inspected; no new layout screenshot needed.
- [x] Applied migrations, Site identity, owner-private audience, and AI settings unchanged.
- [ ] General concurrent contact PATCH/import conflict resolution implemented.
- [ ] Hosted D1 fault injection and forced OS/browser shutdown tested.

This closes the specific already-saved-draft gap left by the earlier sent-draft iteration. Unsaved text and old open browser bundles remain outside that guarantee.

The final full-suite release gate now passes. The earlier intermittent timeouts were not reproduced in the resumed verification pass; their root cause is still unknown. Publication must be confirmed from the native deployment result and GitHub head.

## Contact Patch Checks - October 12, 2026

- [x] Overlapping successful saves losing relationship notes reproduced before the fix.
- [x] Intervening reply loss, stale guard, and deleted-contact recreation reproduced before the fix.
- [x] 69 unit/integration tests pass.
- [x] Explicit empty values, false flags, arrays, normalization, owner isolation, identity/provenance, malformed input, and write failure checked.
- [x] Write-time timestamp guard and exact write acknowledgement checked against local SQLite.
- [x] Reviewed acknowledgement race reproduced and fixed; older send cannot clear a later identical-text draft.
- [x] Final production build passes after review fix.
- [x] Focused two-window notes/reminder/draft/favorite and reload checks pass.
- [x] Full Chromium core-journey suite and new two-window persistence check pass on the final implementation.
- [x] Applied migrations, Site identity, private audience, and AI configuration unchanged.
- [ ] General same-field/import conflict resolution or hosted D1 fault/load testing performed.

The fix preserves unsubmitted fields during server PATCH writes. It does not promise automatic merging of same-field edits, conflict-free forms/imports, or real-time LinkedIn access. No visible layout change requires a new portfolio screenshot.

## Relationship Form Checks - October 12, 2026

- [x] Note-only form edit reverting a newer company reproduced before the fix.
- [x] 74 unit/integration tests and final production build pass.
- [x] Focused browser checks preserve newer company/role/circles and exact conversation timestamps.
- [x] Imported rhythm displays accurately; unchanged saves issue no write; explicit clears/date/circle edits persist.
- [x] Initial full Chromium suite, rejected-save retry, and desktop/mobile form captures verified.
- [x] Reviewed lost-acknowledgement revert regression reproduced in unit and browser tests; submitted-field retry intent implemented.
- [x] Complete Chromium suite passes on final application code after the reviewed retry fix.
- [x] Final focused browser rerun passes after strengthening request-specific failure synchronization.
- [x] Server/API contracts, applied migrations, Site identity, owner-private audience, and AI configuration unchanged.
- [ ] Same-field merge or pending-form/shutdown recovery implemented.

This extends submitted-field safety to the relationship editor. No real data, paid services, or outbound actions were used.

## Person Save Lifecycle Checks - October 12, 2026

- [x] Slow confirmation discarding newer form typing reproduced before the fix.
- [x] Actual Save button and duplicate submit events guarded during pending saves.
- [x] Initial focused and complete Chromium suites pass.
- [x] Reviewed post-commit refresh duplication reproduced before ID-presence repair.
- [x] Final production build and 74 unit/integration tests pass.
- [x] Final focused timing/failure/creation checks and desktop/mobile status review pass.
- [x] Independent final re-review complete with no further high-confidence finding.
- [x] Complete Chromium suite passes on final build.
- [ ] Circle lifecycle parity, person-form crash recovery, or idempotent creation retries implemented.

Pending-save protection does not persist unsaved form values across closing, reload, or shutdown. Private data and external integrations are unchanged; native Site/GitHub results establish publication separately.

## Atomic Circle Checks - October 12, 2026

- [x] Browser failure leaving a half-created circle reproduced before the fix.
- [x] Transaction rollback after metadata and all membership updates verified locally.
- [x] Validation, ownership, untouched memberships, unrelated fields, and capacity race checked.
- [x] Synthetic 10,000-member addition uses one two-statement transaction.
- [x] Initial focused Chromium failure/retry, pending-form, and demo storage checks pass.
- [x] Reviewed draft-version interaction repaired and independently rechecked.
- [x] Final production build, all 84 automated tests, and expanded focused Chromium checks pass.
- [x] Final desktop/mobile error-status captures reviewed.
- [x] Complete Chromium suite passes on final build.
- [ ] Lost-acknowledgement creation identity, metadata conflict resolution, and hosted D1 fault/load testing implemented.

The all-or-nothing guarantee covers a circle save in the updated app. It does not turn imports, older open browser bundles, or arbitrary multi-device edits into one operation.

## Reminder Lifecycle Checks - October 12, 2026

- [x] Delayed reminder save overwriting a newer time reproduced before the fix.
- [x] Production build and all 84 unit/integration tests pass.
- [x] Focused Chromium Set/Clear timing, duplicate/reopen locks, failure/retry, and unrelated-editor checks pass.
- [x] Newer reminder time and unsaved reply focus/selection survive acknowledgement.
- [x] Pending unload/workspace guards, pre-autosave person/time capture, and calendar contents checked.
- [x] Demo storage failure preserves memory/storage, with successful retry/reload and no private write.
- [x] Desktop/mobile status screenshots visually inspected.
- [x] Independent read-only review completed with no actionable finding; nine isolated function checks passed.
- [x] Full Chromium suite passes on final build.
- [ ] Durable reminder-entry recovery, general response ordering, or other-engine/assistive-technology audit implemented.

Pending reminder protection does not retain unsaved time across explicit closing or another action's redraw. Native Site/GitHub results establish publication separately.
