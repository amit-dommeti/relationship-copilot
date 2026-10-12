# Current State

Updated October 12, 2026. Scope: Relationship Copilot only.

## Product And Boundaries

- Dark personal workspace: Today, People, Circles, Inbox, Connections, Preferences.
- ZIP/CSV/pasted contacts with preview and stable-identity deduplication; shared-history circles; explainable shortlist; greeting-first drafts; manual reply tracking and calendar reminders.
- Persistent owner-scoped server storage; fictional demo isolated in the browser. Private Site audience is owner-only; the source repository is public.
- US owner, official LinkedIn access only. No live network/inbox sync, scraping, session-cookie access, brokers, or automatic sending. Personal-agent/export assistance requires fresh approval.
- Optional AI drafting is implemented but not live-evaluated. No-key mode is explicitly a local starter. No model/key or integration changes in this iteration.

## Latest Verified Change

Circle details and changed memberships now save in one transaction instead of a metadata request followed by separate contact requests. The shared plan validates membership; writes add/remove only the current circle in stored arrays. The editor preserves untouched checkbox intent, retains failed-save selections, locks controls while pending, and leaves replacement forms alone. Confirmed creation retains its ID before refresh so a refresh failure cannot create another circle on retry. Demo storage is the commit point before replacing either in-memory collection.

Evidence collected:

- Browser reproduced a failed membership request leaving a half-created circle before the fix.
- Ten focused unit/integration tests pass: full rollback, validation/ownership, unrelated circle/field preservation, capacity races, demo nonmutation, unconfirmed reversions, and 10,000 members in one two-statement batch.
- Initial focused and full Chromium suites passed, including circle retry/timing/demo storage and all preceding import/draft/reply/person checks.
- Independent review found a draft-version acknowledgement interaction. Membership-only writes now preserve draft text and token together; ordinary contact PATCH rotation is unchanged. The follow-through test and independent re-review pass. The final production build, all 84 automated tests, expanded focused Chromium checks, and full desktop/tablet/mobile suite pass, including delayed refresh followed by membership change and the next recorded send. Desktop/mobile status captures were inspected; existing portfolio layouts remain representative. Publication is confirmed separately by native Site success and the GitHub head.
- Existing circle API accepts optional membership deltas with bounded payloads; old metadata-only calls remain compatible. Applied migrations, Site identity, private audience, AI settings, and external integrations are unchanged. Tests use synthetic data only.

Pending person and circle saves warn before unloading and block workspace switches/import confirmation until settled. Unsaved forms remain tab-memory only, and explicitly closing them still discards unsaved values. This is not form autosave, general conflict resolution, or crash recovery. Older open bundles still save circle membership with separate requests until reloaded.

## Earlier Protections

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
- Prior confirmed release: person-save lifecycle, Site source `025ed30285697f9d38e999bc796a2f39d159252e`, GitHub `05c913fa0d2f18db8d4f21d26525c1b3c96b70d6`, identical source tree `a731e0e4a8da3616eb2544040423b3209610a178`. This file records the atomic-circle follow-up, not its own publication receipt.
- Open/synchronize and package via the Sites source helper. Use connected GitHub write tools if local push credentials are unavailable. Never put credentials, contact exports, or private data in GitHub.

## Limits And Next Useful Checks

- Same-field editing, imports racing with edits, and arbitrary out-of-order UI responses are not general conflict-resolved. The optional timestamp guard is not a unique revision and is not currently supplied by forms.
- Unsaved drafts/replies/forms can be lost on forced shutdown. Unload warnings are not guaranteed by every mobile lifecycle. Retry identities do not survive reloads or devices.
- Demo storage is browser-local, subject to eviction, and not cross-tab conflict-safe. Import and circle saves use storage-before-state; other demo actions retain their existing best-effort behavior.
- Chromium checked; other engines, full screen-reader audit, and production D1 load/fault tests remain unverified. Local import tests cover 10,000 contacts, one transactional batch, bounded query count, and injected rollback.
- Preserve browser failure diagnostics. Earlier intermittent toast/autosave timeouts were not reproduced in the previous final passes, but their root cause remains unknown.
- Reminder/preference form lifecycles remain separate; investigate delayed completion before claiming parity. Person/circle creation with a lost acknowledgement can still duplicate on retry; unlike message recording, creation has no retained idempotency key. Circle metadata edits remain last-write-wins.
- Real-user import and live AI preference/latency evaluation require authorization. No adoption, retention, writing-quality uplift, or production incident reduction is claimed.
