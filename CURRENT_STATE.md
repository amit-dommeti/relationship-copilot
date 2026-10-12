# Current State

Updated October 12, 2026. Scope: Relationship Copilot only.

## Product And Boundaries

- Dark personal workspace: Today, People, Circles, Inbox, Connections, Preferences.
- ZIP/CSV/pasted contacts with preview and stable-identity deduplication; shared-history circles; explainable shortlist; greeting-first drafts; manual reply tracking and calendar reminders.
- Persistent owner-scoped server storage; fictional demo isolated in the browser. Private Site audience is owner-only; the source repository is public.
- US owner, official LinkedIn access only. No live network/inbox sync, scraping, session-cookie access, brokers, or automatic sending. Personal-agent/export assistance requires fresh approval.
- Optional AI drafting is implemented but not live-evaluated. No-key mode is explicitly a local starter. No model/key or integration changes in this iteration.

## Latest Verified Change

The relationship editor captures its opening control values in tab memory and submits only fields the user changed. Reproduced a note-only edit restoring an older company after a newer update arrived while the form was open. The focused browser regression now preserves newer company/role, circle membership, and exact last-contact timestamps. An unchanged form without an unconfirmed save makes no write and refreshes saved state before closing. Custom saved check-in rhythms are displayed without silently selecting a preset.

Evidence collected:

- `npm test`: 74 passed, including five new form-value/change-detection/retry tests.
- Production build passed.
- Focused Chromium stale-form test passed, including no-op saves, imported 21-day rhythm, exact conversation timestamp, intentional clearing, and explicit date/circle changes.
- Complete Chromium suite passed on the final application code, including failed-save/retry, lost-confirmation reverts, and desktop/tablet/mobile journeys. A final focused rerun also passed after strengthening failure waits to observe the exact failed request and finished error handling. Synthetic desktop/mobile form captures were inspected; no portfolio layout change was needed.
- Independent review found that a committed save with a lost acknowledgement could ignore an intended revert to the opening value. Reproduced in both unit and browser tests, then retained unconfirmed submitted fields so retry sends their latest values, even when reverted. Re-review found no additional application regression. Publication must be confirmed from the native Site result and GitHub head.
- Server/API contracts, applied migrations, Site identity, private audience, AI settings, and external integrations unchanged. Tests use synthetic data only.

This does not merge conflicting edits to the same field. Explicit circle edits replace that field as before. Retry intent lasts only while that form remains open. Unsaved person forms remain tab-memory only; they do not yet have the draft/reply lifecycle or shutdown protections. Reload an already-open older browser bundle after publication.

## Earlier Protections

- Server PATCH merges only submitted normalized fields into current storage. The optional timestamp guard runs at the write; deleted contacts cannot be recreated by a delayed PATCH. Atomic write acknowledgements keep an older send from receiving another writer's newer draft token.
- Recorded sends clear only matching saved draft versions/text, in the message transaction. Newer and identical-text saves survive. Conversation history preserves drafts by default. The browser does not issue unconditional cleanup writes.
- Draft/reply buffers protect newer input through failures and redraws; retry identities prevent duplicate message history within a retained tab. Late suggestions cannot overwrite newer writing.
- Imports validate the complete payload and commit contacts, circles, history, settings, and receipt in one transaction. Demo restore uses shared preparation and saves browser storage before replacing in-memory state.
- Detailed evidence, earlier test counts, and limitations are preserved in `docs/ITERATION_LOG.md` and `docs/SHIP_CHECKLIST.md`.

## Deployment Context

- App: https://relationship-copilot-amit.plumlyric7.chatgpt.site
- Public source: https://github.com/amit-dommeti/relationship-copilot
- Existing identity is tracked in `.openai/hosting.json`; never replace it or broaden access without approval.
- Prior confirmed release: contact PATCH safety, Site source `8146cdda73c0fce7262b249794805a96e8fb41f3`, GitHub `ed0d0bd948480b375d746ed2c9013eed863be969`, identical source tree `3045b53d3681e16996361ba05897a92d60d66a39`. This file records the relationship-form follow-up, not its own publication receipt.
- Open/synchronize and package via the Sites source helper. Use connected GitHub write tools if local push credentials are unavailable. Never put credentials, contact exports, or private data in GitHub.

## Limits And Next Useful Checks

- Same-field editing, imports racing with edits, and arbitrary out-of-order UI responses are not general conflict-resolved. The optional timestamp guard is not a unique revision and is not currently supplied by forms.
- Unsaved drafts/replies/forms can be lost on forced shutdown. Unload warnings are not guaranteed by every mobile lifecycle. Retry identities do not survive reloads or devices.
- Demo storage is browser-local, subject to eviction, and not cross-tab conflict-safe. Import's storage-before-state guarantee does not extend to every demo action.
- Chromium checked; other engines, full screen-reader audit, and production D1 load/fault tests remain unverified. Local import tests cover 10,000 contacts, one transactional batch, bounded query count, and injected rollback.
- Preserve browser failure diagnostics. Earlier intermittent toast/autosave timeouts were not reproduced in the previous final passes, but their root cause remains unknown.
- A useful future check is whether delayed person/circle form completion can discard newer typing or close a different form; it is not solved by dirty-field submission. Review also flagged the generic submit selector matching Cancel before Save, so inspect the actual pending control rather than assuming the submit button is locked.
- Real-user import and live AI preference/latency evaluation require authorization. No adoption, retention, writing-quality uplift, or production incident reduction is claimed.
