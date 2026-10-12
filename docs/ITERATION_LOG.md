# Iteration Log

The v0 labels below are retrospective feature milestones, not independently validated releases or dated experiments.

## Save The Whole Shared Circle - October 12, 2026

- Reproduced a failed member request leaving a half-created circle: the browser still found the new circle even though its selected person was not added. The editor previously saved metadata and then one contact at a time.
- Added optional membership deltas to the existing circle save. Shared validation and one transaction now cover metadata and all selected additions/removals. Updates modify only this circle ID in current membership arrays, preserving unrelated circles and relationship data; metadata-only callers remain compatible.
- The editor sends only changed checkbox intent, retaining unconfirmed changes for retry. Save locks circle inputs, duplicate submissions, workspace changes, and import confirmation until settled. Delayed completion leaves replacement editors alone. Confirmed creation retains its ID even if the following refresh fails.
- Demo saves persist one complete next state before replacing in-memory data. A simulated storage failure leaves the existing circle and contact collections intact, with retained inputs for retry.
- Ten focused unit/integration tests pass, including rollback after every planned write, owner/validation boundaries, concurrent unrelated changes, capacity races, and 10,000 synthetic membership additions in one two-statement batch. Initial focused browser checks passed for failure/retry, stale untouched membership, lost-confirmation reversions, pending controls, unrelated editors, refresh-failure identity, and demo storage/reload isolation.
- Independent review reproduced a draft-version/refresh interaction in the initial implementation. Membership-only saves now preserve draft text and token together, so they cannot invalidate a newer autosave acknowledgement. Independent re-review found no remaining issue in the narrow fix. The final production build, all 84 automated tests, expanded focused Chromium checks, and complete desktop/tablet/mobile browser suite pass, including delayed refresh followed by membership change and the next recorded send. Desktop/mobile error-status captures were inspected; existing portfolio layouts remain representative.
- No private contact data, LinkedIn/email access, AI evaluation, paid services, access changes, or applied migration changes. Limits include same-field metadata conflicts, lost-acknowledgement creation retries, old open bundles, and unsaved-form shutdown loss. No user-outcome or production-load claim is made.
- Publication is established separately by the native Site success and GitHub head.

## Keep Editing During A Slow Save - October 12, 2026

- Reproduced a delayed relationship save closing the form and discarding text entered after Save. The generic submit selector also disabled Cancel instead of Save; it now prioritizes the explicit submit control.
- Keep one pending operation per person form. On confirmation, advance only its submitted baseline, retain newer values/focus/selection in the existing editor, and show a persistent status. A late completion cannot close a replacement form. Errors preserve the previous baseline and unconfirmed-field retry intent.
- Successful creation retains its returned identity for subsequent edits. Independent review caught duplicate browser rows when a background refresh saw the committed creation before its delayed acknowledgement. Reproduced two rows in Chromium; insert only an absent ID, preserving the newer refreshed record.
- Pending person saves now warn before unload and block workspace changes/import confirmation. No new persistent copy of private relationship notes was introduced.
- Verified 74 unit/integration tests and production build. Initial complete Chromium suite passed. Final expanded focused and complete Chromium suites pass after the reviewed repair, including existing import/draft/reply protections and desktop/tablet/mobile routes. Desktop/mobile status captures were inspected; no portfolio layout refresh was needed. Independent re-review found no further high-confidence issue.
- New synthetic checks cover delayed success, changed-back values, rejected-save/latest retry, no-op refresh typing, duplicate submit events, focus/selection, unrelated editors, workspace/unload guards, continued creation, and post-commit delayed acknowledgement. Test setup corrections included waiting for routed requests during teardown, selecting one of two Add person controls, and matching the actual company row/search filter.
- No real contact data, AI calls, external access, paid services, sharing changes, server contract changes, or applied migration changes.
- Limits: not form autosave/crash recovery, general cross-device conflict resolution, circle-form lifecycle protection, or idempotent creation after a lost acknowledgement. Explicitly closing a form still discards its unsaved values. No user-outcome or AI-quality uplift is claimed.
- Publication must be confirmed by native Site success and the GitHub head.

## Edit Only What You Meant To Change - October 12, 2026

- Reproduced a note-only relationship edit restoring an older company after another update arrived while the form was open. The form sent every control, defeating the preceding server-side submitted-field protection.
- Capture each form's opening control values in a weakly held, tab-memory snapshot. Updates send only changed fields; new-person creation still sends the complete form. Unchanged forms without an unconfirmed save refresh saved state without a write. Failed attempts retain the same baseline for retry.
- Preserve exact last-contact timestamps when the displayed date was not edited. Include the person's existing check-in rhythm in the select options instead of falling back to an unrelated preset. Explicit clears, dates, rhythms, and circle changes remain writable.
- Verified 74 unit/integration tests, including five form snapshot/change-detection/retry tests, and the final production build. Focused Chromium regression passes for newer company/role/circles, recorded conversation timestamps, a 21-day rhythm, no-op saves, and intentional clearing/date/circle edits.
- Initial full Chromium checks passed, including failed-save/retry and desktop/mobile form framing. Inspected synthetic form captures; existing portfolio screenshots remain representative.
- Independent review caught an ambiguous-save regression: after a committed write with a lost response, reverting to the opening value was treated as a no-op. Reproduced with unit and real browser tests that commit the write then abort its response. Retain unconfirmed submitted fields and send their latest values on retry, including intended reverts. Re-review found no further application regression.
- The final application code passed the complete Chromium core-journey suite, including the lost-acknowledgement revert. Review also identified a test wait that watched the wrong button; strengthened it to await the exact failed request and completed handler cleanup. The corrected focused browser check passed afterward. No assertion or timeout was weakened.
- No real contacts, model calls, LinkedIn access, account changes, or applied migration changes were used.
- Limits: no same-field merge, multi-device conflict UI, person-form crash recovery, or pending-form lifecycle redesign. Retry intent lasts only in the still-open form. An explicit circle edit still replaces the submitted circle list. Old open bundles require reload. No user outcome or AI-quality improvement is claimed.
- Publication is established by the native Site result and GitHub head, not inferred from this log.

## Save Only What Changed - October 12, 2026

- Reproduced two overlapping successful PATCH requests that silently restored old relationship notes while setting a reminder. Controlled read/write interleaving also reproduced loss of a new reply's state, an ineffective stale-write guard, and resurrection of a deleted contact.
- Replaced full-record saves on the PATCH path with one owner-scoped, submitted-field JSON update. Normalization still applies; empty values, false flags, and empty circle lists remain intentional edits. Identity, creation time, and provenance cannot be overwritten. Draft versions continue rotating on each ordinary save.
- Moved the optional timestamp guard into the update predicate. Deleted contacts return not found rather than being inserted again. Malformed PATCH bodies return a useful error without writes.
- Verified 69 unit/integration tests. Nine new tests cover forced overlapping reads, intervening messages/deletion, explicit clearing, field normalization, ownership/provenance, malformed input, write-time guards, atomic acknowledgement, and a failed write that preserves all fields and the draft version.
- Independent review identified a read-back race in the first implementation: returning a later writer's token could let an older send clear a newer identical-text draft. Reproduced it, changed the operation to `UPDATE ... RETURNING`, and verified the acknowledgement belongs to its own write. Re-review found no remaining issue in that fix; all 14 focused PATCH/draft tests passed.
- Final production build, focused two-window Chromium checks, and the complete Chromium core-journey suite passed after the review fix. Coverage includes notes/reminder/draft/favorite saves, reload persistence, desktop/tablet/mobile routes, imports, reply recovery, retries, and demo isolation. Earlier attempts caught new-test setup mistakes: a single-page context could not open another tab, and fragment navigation retained the previous in-memory contact list. Corrected the test to use a separate page and explicit reload; no application assertions or time limits were weakened. Storage overlap is forced by the API tests, not inferred from sequential browser clicks.
- This is a behavior-only change; existing portfolio captures remain representative. Applied migrations, Site identity, owner-private audience, AI settings, and external integrations remain unchanged.
- Limits: same-field edits use last-write-wins unless a usable timestamp guard is supplied; current forms do not supply it. Timestamps can coincide within one millisecond. Unchanged fields sent by a form still count as writes. Import/edit conflicts, arbitrary delayed UI responses, and browser-local demo cross-tab conflicts are not solved. No hosted D1 fault/load test or user-outcome/AI evaluation was performed.
- Publication is established by the native Site result and GitHub head, not inferred from this log.

## Clear Only The Sent Version - October 11, 2026

- Reproduced the remaining storage-side loss: a delayed outgoing record erased an already-saved newer draft. The previous browser repair required another save to complete.
- Added server-generated saved-version tokens and an optional message clear guard. Only matching version plus exact normalized sent text can clear the draft, with message ordering and retry guards preserved. Clear, contact-state update, and insertion commit or roll back together.
- Conversation history and older API clients preserve drafts by default. Legacy/imported contacts can explicitly match an absent version; malformed guards reject. Retries retain their original clear guard as well as their identity.
- Removed unconditional browser cleanup saves. Newer local edits use the existing save queue; unchanged editors display the refreshed saved result and remain open when a draft was preserved. Demo applies equivalent conditional clearing.
- A focused independent review identified a stale-refresh follow-on: an older snapshot could replace the version of a newly acknowledged draft. Retain acknowledged text/version pairs across in-flight refreshes and extend the browser case through the next recorded send, not just preservation of its displayed text.
- Verified 60 unit/integration tests and the production build. Six added tests cover matching, newer and identical-text saves, legacy compatibility, malformed guards, history/replay, rollback, and retry-guard stability.
- The initial implementation passed the full Chromium suite across desktop/tablet/mobile. Final focused sent-draft checks pass after review fixes, including a subsequent send after an intervening metadata save. They confirm newer data survives before acknowledgement, lost acknowledgement requires no repair write, another simulated client's completed save is preserved and displayed, and separate outgoing history leaves the draft intact across reload.
- Publication was initially held after four full reruns timed out on existing toast-dismissal or autosave-status waits. A separate reply-buffer run passed and logged its error timer firing after approximately nine seconds. No JavaScript page errors appeared in the last failed full run; added failure status/error/screenshot diagnostics without weakening checks.
- On the resumed October 11 pass, all 60 unit/integration tests, the production build, and two consecutive complete Chromium runs passed on the final implementation, including the reviewed refresh/metadata/next-send case. No application code or assertion/time-limit changes were needed for these reruns. The earlier timeouts did not reproduce; their cause remains unknown, not claimed fixed.
- Inspected synthetic desktop/mobile pending-state captures; no layout change required a new portfolio screenshot. Applied SQL, Site identity, owner-private audience, AI settings, and external integrations remain unchanged.
- Limits: not general cross-device editing conflict resolution or durable recovery of unsaved text. An already-open old browser bundle can still perform its previous cleanup; reload after release. No hosted D1 fault injection, forced OS shutdown, real-user experiment, or AI quality evaluation was performed.
- The release gate now passes. Publication is established by the native Site result and GitHub head, not inferred from this log.

## Restore The Whole Demo Backup - October 11, 2026

- Reproduced a restore from Preferences that reported success while dropping a backup's saved message: the browser expected one restored record and found zero. Demo imports also ignored writing preferences and the import receipt.
- Extracted the existing private-workspace import preparation into a shared, non-mutating plan. Demo restores now include messages, circles, writing preferences, and metadata while preserving existing relationship context, identified history, notification settings, and demo capabilities. The server keeps the same transactional writes, query bounds, and owner isolation.
- Made browser storage the demo import's commit point. A rejected backup or failed storage write leaves the previous state unchanged, with a persistent dialog error and retry available. No private API write occurs in demo mode.
- Added a backup-specific preview of message/circle counts, restored preferences, and preserved data, plus an explicit demo-only destination notice and Restore backup action.
- Verified 54 unit/integration tests, including five new demo/real-store parity, repeat-restore, non-mutation, contact-only, and legacy-backup tests. Production build and the focused Chromium restore checks passed, including actual reload persistence, orphan rejection, quota-failure injection/retry, and private-workspace isolation.
- Full Chromium core-journey suite passed across desktop/tablet/mobile, including existing private restore, drafts, reply recovery, retry, and sent-draft protection checks. Import errors are now announced once in the persistent dialog instead of duplicated in a toast.
- Inspected desktop/mobile preview captures; added a real browser screenshot containing only synthetic data. No LinkedIn account, private contact file, live AI call, paid service, or sharing change was involved.
- Limits: demo storage remains browser-local and can be cleared or evicted. Other demo actions still use their existing save behavior; simultaneous tabs and production D1 fault/load testing were not added. No user outcome or model-quality improvement is claimed.
- Publication is established by the native Site result and GitHub head, not inferred from this log.

## Keep The Next Draft - October 10, 2026

- Reproduced a delayed "I sent it" completion erasing a newer, already-saved draft: the browser regression expected the newer text and found an empty stored draft instead.
- Captured the clicked person, text, and edit revision before autosave. Kept a per-person pending lock through completion, including drawer reopening. Workspace changes and imports wait for the complete operation.
- Clear only the submitted edit; re-save newer writing after the outgoing record completes, including a lost acknowledgement. Check again after cleanup so typing during the empty-draft save survives. Do not close or redraw a different conversation/form.
- Verified 49 unit/integration tests and the production build. Focused Chromium checks cover saved newer text, cursor/focus, text changed and restored, pending duplicate prevention, unrelated conversation input, switching people before autosave completes, typing during cleanup, and recovery after an actual local write with a dropped acknowledgement.
- Full Chromium core-journey suite passed across desktop/tablet/mobile. Inspected synthetic desktop/mobile captures of the pending-recording control; no new portfolio screenshot was needed for this behavior-only change.
- The change is current-tab coordination. Forced shutdown between recording and re-saving newer writing, concurrent devices, and other browser engines remain outside this guarantee. No live AI evaluation, LinkedIn access, external message sending, paid service, or private user fixture was used.
- Publication is established by the native Site result and GitHub head, not inferred from this log.

## Retry Without Duplicate History - October 10, 2026

- Reproduced the missing retry contract: two submissions of the same identified recording produced two history entries because the endpoint replaced the identity with a new one each time.
- Added optional, validated save identities and a shared tab-memory recorder for replies and manually recorded sends. Unchanged retries retain their identity across a rejected/lost acknowledgement or failed state refresh. Confirmed new recordings and changed payloads get new identities, preserving intentional repeated messages.
- Guarded the contact-state update and message insert in one transaction. Replaying a stored identity returns the original record and timestamp without resetting later state. Conflicting reuse is rejected; owner scoping and compatibility with older clients are retained. Applied migrations remain unchanged.
- Verified 48 unit/integration tests, including six API/storage tests and five recorder tests. Cases cover matching and conflicting concurrent requests, subsequent state preservation, owner isolation, invalid identities, legacy clients, rollback after a failed insert, and retry lifecycle behavior.
- Production build and full Chromium core-journey checks passed. New browser fault injection performed the actual local write, then dropped its response, reopened the contact, and retried. Also verified failed-refresh recovery, later state preservation, intentional repeat recording, and the "I sent it" path. Existing desktop/tablet/mobile flows remain passing.
- No visible layout change required a new screenshot. Existing synthetic-data captures remain representative. No real contacts, LinkedIn messages, live model calls, paid services, or access-policy changes were involved.
- Boundary: request identity remains in the current tab only. Reload, a changed entry, or another tab is not guaranteed to recover the same identity. This is not universal exactly-once delivery, cloud fault testing, or evidence of user impact.
- Publication is established by the native Site result and GitHub head, not inferred from this log.

## Preserve Unsaved Replies - October 10, 2026

- Reproduced a browser regression: setting a reminder erased the unsaved message text in the same Conversation panel.
- Added tab-memory reply buffers keyed by person and workspace, preserving text and direction through reminder changes, tab navigation, and closing/reopening the drawer. No new persistent private-data cache was added.
- Captured the person and exact edit revision for each save. Slow successful saves clear only unchanged input; newer typing and cursor position remain intact. Completing a background save does not redraw a different person's form.
- Kept pending status through redraws and blocked duplicate submissions while a request is outstanding. Failed saves retain the text with a persistent status. Unload warnings include unsaved replies; switching workspaces brings the unsaved entry back into view for saving or clearing.
- Verified 37 unit/integration tests, production build, and full Chromium core-journey checks. Six new buffer tests cover identity isolation, duplicate prevention, failure/retry, newer input, empty edits, and stale completions. Browser checks cover the reproduced reminder failure, navigation, person isolation, controlled slow/failing saves, cursor preservation, reload warning, and the workspace-switch safeguard.
- Desktop/mobile failure-state captures use synthetic text only. No real messages, LinkedIn access, paid services, model calls, or audience changes were involved.
- Limits: tab crash/forced shutdown can lose unsaved entries. Pending-request duplicate prevention is not exactly-once delivery: an unacknowledged server write could still duplicate on retry. Unsaved reminder/person/settings forms are not covered by this reply-specific buffer. No user outcome or model-quality uplift is claimed.
- Publication is established by the native Site result and GitHub head, not inferred from this log.

## All-Or-Nothing Imports - October 10, 2026

- Reproduced partial mutation with an API regression: a backup with a valid company update and malformed message contact ID returned an error after changing the saved company.
- Added shared full-payload validation for preview and server processing. Invalid records and collection limits now reject the complete import instead of silently skipping or truncating messages.
- Consolidated contacts, circles, history, restored preferences, and import metadata into one transactional database batch. Bounded JSON inserts support the existing 10,000-contact limit without one hosted query per person. Applied migrations are unchanged.
- Preserved matching-contact notes, drafts, circle membership, and reply state; existing circles and notification settings are not replaced. Historical messages are mapped to the matched person. Stable message IDs make repeated backup imports idempotent.
- Cleared stale previews while reading a new file and ignored superseded/closed-dialog reads. Persistent accessible errors leave no old confirmation button behind.
- Verified 31 unit/integration tests, including seven new import tests: malformed payloads, complete rollback after an injected storage failure, identity remapping, repeat restore, owner isolation/orphan rejection, and a bounded 10,000-contact import. Production build and full Chromium core-journey checks passed; browser regressions cover invalid-file replacement, delayed file reads, unchanged data after rejection, corrected restore, and reload persistence.
- Inspected desktop/mobile error-state captures with synthetic data. No real contacts, LinkedIn access, live AI calls, or paid services were used. Local SQLite testing is not a hosted D1 load test; concurrent edits across devices remain outside this verification.
- Publication is established by the native Site result and GitHub head, not inferred from this log.

## Your Edits Win - October 10, 2026

- Reproduced a late-response overwrite in Chromium: a simulated draft response replaced a newer, already-saved handwritten message.
- Scoped each generation request to its contact and current workspace session. New typing, intent changes, choosing a variant, recording a send, or saving updated relationship/reply context invalidates the older response. Workspace changes and confirmed imports discard outstanding jobs.
- Kept loading state across drawer/tab rendering and prevented duplicate requests for the same contact. Failures restore the actual drafting action rather than leaving an enabled button labeled Writing.
- Avoided redrawing the Conversation form when a background draft completes, preserving its unsaved input and focus.
- Verification: 24 unit/integration tests, production build, and Chromium browser flows with controlled delayed responses. Browser cases cover cursor/text preservation, loading state, duplicate prevention, error recovery, intent changes, unrelated form input, sent-draft protection, and switching away/back while old and new requests share a contact ID.
- Tradeoff: stale results are discarded, not merged into human writing. An invalidated provider request can still finish and incur its normal cost; this is result isolation, not a billing-cancellation guarantee. No live model call or writing-quality improvement is claimed.

## Draft recovery - October 10, 2026

- Reproduced a save failure in the browser: after a contact update returned 503, Copy message never reached the clipboard action. The failed promise also blocked other actions, and reopening the composer mislabeled the draft as saved.
- Replaced the single pending slot with a serial, per-contact save queue. Failed writes retain the latest edit for retry; a late response cannot erase a newer queued edit. Empty drafts are intentional writes too.
- Kept copying and read-only navigation available during outages. Added truthful save status, a keyboard-accessible retry control, polite status announcements, and a browser unload warning while drafts remain unsaved.
- Applied recovery to typed drafts, generated starters/variants, and clearing a sent draft. Workspace switching and replacing/exporting data still wait for pending saves.
- Verified 19 unit/integration tests, the production build, and Chromium product flows at desktop/tablet/mobile sizes. The browser regression covers failure, repeated failure, copying, tab/drawer navigation, retry without retyping, reload warning, persisted recovery, empty drafts, and a generated starter's failed save. Reviewed desktop/mobile captures; committed one synthetic-data recovery screenshot.
- Initial publication failed with `table contacts already exists`. Artifact inspection found a stale duplicate SQL file in generated output, not in source. Reproduced the packaging flaw locally and added clean-build output plus an isolated regression. Preserved the applied SQL, journal, database binding, and stored records unchanged.
- No durable offline cache was added. Browser crash/forced shutdown can still lose unsaved text; keep the tab open or copy the message. No live AI evaluation, LinkedIn access, or user outcome study was performed.
- Publication is confirmed by the Site deployment result and GitHub branch, not inferred from these local checks.

## v2.0 - October 9, 2026

- Rebuilt the dark workspace into Today, People, Circles, Inbox, Connections, and Preferences.
- Added direct ZIP import with preview, stable-identity matching, saved import metadata, backup restore, and preserved relationship notes.
- Added persistent owner-scoped storage, isolated demo data, cadence, snooze/undo, calendar reminders, draft persistence, and reply history.
- Replaced the proposed third-party sync route after the owner chose official-only access. Confirmed US location; personal portability is ineligible. No account connection or export was attempted.
- Added optional structured AI drafting with narrow context and explicit no-key starter mode. Model tests are mocked; live quality is not yet evaluated.
- Added portable Node/Docker and hosted Worker packaging, security tests, responsive browser checks, and real screenshots.
- Next experiment: one authorized real import, then three thoughtful messages in a week. No outcome is claimed yet.

## v0.1 Product Framing

- Defined target user, user problem, MVP, risks, and platform constraints.
- Chose local-first workflow because LinkedIn personal data access is restricted.

## v0.2 LinkedIn Import

- Added `Connections.csv` upload.
- Parsed imported name, company, position, URL, and connected date.
- Stored contacts in browser localStorage.

## v0.3 Weekly Recommendations

- Added local recommendation scoring.
- Ranked contacts by warmth, recency, message readiness, and status.
- Added optional AI recommendation endpoint with local fallback.

## v0.4 Dark Productivity UI

- Reworked the interface into a dark-mode productivity cockpit.
- Added dashboard metrics, recommendation cards, and stronger visual hierarchy.

## v0.5 Relationship Clusters

- Added clusters based on where the user knew people from.
- Auto-clustered imported contacts by company.
- Added cluster memory to reuse shared context across old coworkers.

## v0.6 Human Message Composer

- Replaced brittle template insertion.
- Added greeting-first messages.
- Rewrote third-person notes into second-person language.
- Added a smoke test for the Maya sample case.

## v0.7 Response Tracking

- Added reply capture and `needs reply` status.
- Added reminder date/time.
- Added browser notifications while the app is open.
- Added response cards to keep follow-through visible.
