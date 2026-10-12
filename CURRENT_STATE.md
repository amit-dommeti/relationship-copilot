# Current State

Updated October 12, 2026. Scope: Relationship Copilot only.

## Product And Boundaries

- Dark personal workspace: Today, People, Circles, Inbox, Connections, Preferences.
- ZIP/CSV/pasted contacts with preview and stable-identity deduplication; shared-history circles; explainable shortlist; greeting-first drafts; manual reply tracking and calendar reminders.
- Persistent owner-scoped server storage; fictional demo isolated in the browser. Private Site audience is owner-only; the source repository is public.
- US owner, official LinkedIn access only. No live network/inbox sync, scraping, session-cookie access, brokers, or automatic sending. Personal-agent/export assistance requires fresh approval.
- Optional AI drafting is implemented but not live-evaluated. No-key mode is explicitly a local starter. No model/key or integration changes in this iteration.

## Latest Verified Change

The relationship editor now retains typing entered after clicking Save, keeping the same form, focus, and selection. Confirmation advances its submitted snapshot, not its latest controls. Duplicate submit events are blocked; the actual Save control is disabled instead of Cancel. A late result only closes its own unchanged form, not a different editor. Successful creation retains its returned identity for further edits and skips insertion when a background refresh already loaded that person.

Evidence collected:

- `npm test`: 74 passed, retaining the existing form-value/change-detection/retry coverage.
- Production build passed.
- Reproduced delayed-save loss of newer typing before the fix. Initial focused and complete Chromium checks passed, including draft/import/reply and responsive journeys.
- Independent review caught duplicate browser rows when refresh observed a committed creation before its delayed response. Reproduced two rows in Chromium and added an ID-presence guard that preserves the refreshed entry.
- Final focused and complete Chromium suites pass, including slow rejection/latest retry, no-op refresh typing, delayed creation acknowledgement after refresh, existing import/draft/reply protections, and desktop/tablet/mobile routes. Desktop/mobile status captures were visually inspected; existing portfolio layouts remain representative. Independent re-review found no further high-confidence issue. Publication is established by native Site success and the GitHub head, separately from these checks.
- Server/API contracts, applied migrations, Site identity, private audience, AI settings, and external integrations unchanged. Tests use synthetic data only.

Pending person saves warn before unloading and block workspace switches/import confirmation until settled. Unsaved person forms remain tab-memory only, and explicitly closing them still discards their unsaved values. This is not form autosave, general conflict resolution, or crash recovery. Reload an already-open older browser bundle after publication.

## Earlier Protections

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
- Prior confirmed release: relationship dirty-field/retry safety, Site source `f9037b4d1ab03a01d5ae56418ff62ac36f1d65b0`, GitHub `b63957d21aec64d1a77d27f4f744d0faca348e33`, identical source tree `8995fddd34287c4f2e601d858e0979f56e1f3470`. This file records the pending-save follow-up, not its own publication receipt.
- Open/synchronize and package via the Sites source helper. Use connected GitHub write tools if local push credentials are unavailable. Never put credentials, contact exports, or private data in GitHub.

## Limits And Next Useful Checks

- Same-field editing, imports racing with edits, and arbitrary out-of-order UI responses are not general conflict-resolved. The optional timestamp guard is not a unique revision and is not currently supplied by forms.
- Unsaved drafts/replies/forms can be lost on forced shutdown. Unload warnings are not guaranteed by every mobile lifecycle. Retry identities do not survive reloads or devices.
- Demo storage is browser-local, subject to eviction, and not cross-tab conflict-safe. Import's storage-before-state guarantee does not extend to every demo action.
- Chromium checked; other engines, full screen-reader audit, and production D1 load/fault tests remain unverified. Local import tests cover 10,000 contacts, one transactional batch, bounded query count, and injected rollback.
- Preserve browser failure diagnostics. Earlier intermittent toast/autosave timeouts were not reproduced in the previous final passes, but their root cause remains unknown.
- Circle/reminder/preference form lifecycles remain separate; investigate their delayed completion and partial-save behavior before claiming parity. A person-creation write with a lost acknowledgement can still create a duplicate on retry; unlike message recording, creation has no retained idempotency key.
- Real-user import and live AI preference/latency evaluation require authorization. No adoption, retention, writing-quality uplift, or production incident reduction is claimed.
