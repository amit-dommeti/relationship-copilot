# Iteration Log

The v0 labels below are retrospective feature milestones, not independently validated releases or dated experiments.

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
