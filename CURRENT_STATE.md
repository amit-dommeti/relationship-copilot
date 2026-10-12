# Current State

Updated October 12, 2026. Scope: Relationship Copilot only.

## Product And Boundaries

- Dark personal workspace: Today, People, Circles, Inbox, Connections, Preferences.
- ZIP/CSV/pasted contacts with preview and stable-identity deduplication; shared-history circles; explainable shortlist; greeting-first drafts; manual reply tracking and calendar reminders.
- Persistent owner-scoped server storage; fictional demo isolated in the browser. Private Site audience is owner-only; the source repository is public.
- US owner, official LinkedIn access only. No live network/inbox sync, scraping, session-cookie access, brokers, or automatic sending. Personal-agent/export assistance requires fresh approval.
- Optional AI drafting is implemented but not live-evaluated. No-key mode is explicitly a local starter. No model/key or integration changes in this iteration.

## Latest Verified Change

Reminder Set/Clear captures its person and submitted time before awaiting draft autosave. One pending operation per person survives drawer reopening. Confirmation updates only the matching reminder controls, without redrawing the drawer or replacing newer time, reply text, focus, or a different editor. Inline saving/error feedback supports retries. Calendar download uses the currently displayed person and time immediately, independently of draft saving.

Evidence collected:

- Browser reproduced a delayed reminder save replacing a newer entered time with the older submitted time before the fix.
- Production build and all 84 unit/integration tests pass. Expanded focused Chromium checks pass for slow Set/Clear, new time and reply cursor preservation, duplicate/reopen locks, failure/retry, unload/workspace guards, unrelated editors, pre-autosave identity, calendar download, and past-time validation.
- Demo reminder saves write storage before replacing in-memory state. Injected storage failures preserve both states; retry and reload persistence pass with no private-workspace writes.
- Desktop/mobile status captures were inspected. Existing portfolio screenshots remain representative. Independent read-only review found no actionable issue in the scoped diff; nine isolated function checks passed. The complete Chromium suite passes on the final build, including six desktop/tablet/mobile routes and the preceding import/draft/reply/person/circle protections. Publication is confirmed separately by native Site success and the GitHub head.
- No server contract, applied migration, Site identity, audience, AI setting, or external integration changes. Tests use synthetic data only.

Pending person, circle, and reminder saves warn before unloading and block workspace switches/import confirmation until settled. Unsaved forms remain tab-memory only, and explicitly closing them still discards unsaved values. This is not form autosave, general conflict resolution, or crash recovery. Older open bundles retain their previous behavior until reloaded.

## Earlier Protections

- Circle details and changed memberships commit together, with untouched checkbox intent and unrelated circles preserved. Failure retains selections; demo persistence precedes in-memory replacement. Membership-only writes preserve draft text and version together. Confirmed creation retains its identity before refresh.
- Person saves preserve newer typing, focus, and selection; confirmations advance only their submitted baseline. Repeat submissions are blocked and delayed completions leave other forms alone. Continued creation updates the confirmed identity and avoids duplicate insertion after refresh.
- Relationship forms submit only changed fields plus unconfirmed retry intent, preserving newer untouched metadata and exact timestamps. Custom check-in rhythms remain selectable. Intentional clears and lost-acknowledgement reverts persist.
- Server PATCH merges only submitted normalized fields into current storage. The optional timestamp guard runs at the write; deleted contacts cannot be recreated by a delayed PATCH. Atomic write acknowledgements keep an older send from receiving another writer's newer draft token.
- Recorded sends clear only matching saved draft versions/text, in the message transaction. Newer and identical-text saves survive. Conversation history preserves drafts by default. The browser does not issue unconditional cleanup writes.
- Draft/reply buffers protect newer input through failures and redraws; retry identities prevent duplicate message history within a retained tab. Late suggestions cannot overwrite newer writing.
- Imports validate the complete payload and commit contacts, circles, history, settings, and receipt in one transaction. Demo restore uses shared preparation and saves browser storage before replacing in-memory state.
- Detailed evidence, earlier test counts, and limitations are preserved in `docs/ITERATION_LOG.md` and `docs/SHIP_CHECKLIST.md`.

## Deployment Context

- App: https://relationship-copilot-amit.plumlyric7.chatgpt.site
- Public source: https://github.com/amit-dommeti/relationship-copilot
- Existing identity is tracked in `.openai/hosting.json`; never replace it or broaden access without approval.
- Prior confirmed release: atomic-circle saves, Site source `7066ab92c3ef099ec157b64d63f04f33ba62a9b6`, GitHub `92d1e7cf59fccef0c230b8e832778b99c6fdafe5`, identical source tree `3cd43f49542800626cb487c5c7f8f55c94992bbe`. This file records the reminder follow-up, not its own publication receipt.
- Open/synchronize and package via the Sites source helper. Use connected GitHub write tools if local push credentials are unavailable. Never put credentials, contact exports, or private data in GitHub.

## Limits And Next Useful Checks

- Same-field editing, imports racing with edits, and arbitrary out-of-order UI responses are not general conflict-resolved. The optional timestamp guard is not a unique revision and is not currently supplied by forms.
- Unsaved drafts/replies/forms can be lost on forced shutdown. Unload warnings are not guaranteed by every mobile lifecycle. Retry identities do not survive reloads or devices.
- Demo storage is browser-local, subject to eviction, and not cross-tab conflict-safe. Import, circle, and reminder saves use storage-before-state; other demo actions retain their existing best-effort behavior.
- Chromium checked; other engines, full screen-reader audit, and production D1 load/fault tests remain unverified. Local import tests cover 10,000 contacts, one transactional batch, bounded query count, and injected rollback.
- Preserve browser failure diagnostics. Earlier intermittent toast/autosave timeouts were not reproduced in the previous final passes, but their root cause remains unknown.
- Preference and other action lifecycles remain separate. Reminder entry is not buffered across explicit tab changes, closing, or another action's redraw; failures after reopening ask the user to review the displayed time. Person/circle creation with a lost acknowledgement can still duplicate on retry; unlike message recording, creation has no retained idempotency key. Same-field edits remain last-write-wins.
- Real-user import and live AI preference/latency evaluation require authorization. No adoption, retention, writing-quality uplift, or production incident reduction is claimed.
