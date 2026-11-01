# Current State

Updated November 1, 2026. Scope: Relationship Copilot only.

## Product And Boundaries

- Dark personal workspace: Today, People, Circles, Inbox, Connections, Preferences.
- ZIP/CSV/pasted contacts with preview and stable-identity deduplication; shared-history circles; explainable shortlist; greeting-first drafts; manual reply tracking and calendar reminders.
- Persistent owner-scoped server storage; fictional demo isolated in the browser. Private Site audience is owner-only; the source repository is public.
- US owner, official LinkedIn access only. No live network/inbox sync, scraping, session-cookie access, brokers, or automatic sending. Personal-agent/export assistance requires fresh approval.
- Optional AI drafting is implemented but not live-evaluated. No-key mode is explicitly a local starter. No model/key or integration changes in this iteration.

## Latest Verified Change

Reproduced a slow import completing after dismissal, closing an unrelated person editor and losing its unsaved name. Import completion now closes/navigates only its original still-open dialog. A dismissed import can finish without disturbing another editor's input or focus; errors target the originating preview or a toast when it is gone.

- Capture the confirmed preview and circle before awaiting saves. Lock file/paste/circle/confirmation controls while saving, ignore replacement drops, prevent overlapping imports and private/demo switches, and warn before unload while the import remains pending.
- Failures restore the same preview controls for retry. No new persistent copy of private data, server changes, migrations, AI calls, or account access.
- Production build, all 84 automated tests, focused Chromium regressions, and the complete desktop/tablet/mobile browser suite pass on final source. Synthetic pending-state captures inspected; no overflow or overlap. Independent review found a stale People list and an offscreen pagination focus fallback; both were repaired and covered, with no further finding in the narrow re-review. Publication is established separately by native Site success and the GitHub head.
- Explicit dismissal is not cancellation: an already submitted import may still finish. This is not durable recovery, a new server idempotency guarantee, or general import/edit conflict resolution. A completion after dismissal updates visible People rows in place; other page summaries and filter options update on their next render.

## Previous Keyboard Verification

Contact details support Left/Right arrows with wraparound, Home/End, a single active tab in the Tab sequence, and labeled content panels. Switching tabs retains focus; activating the already selected tab leaves unsaved controls alone. Dialog Tab movement excludes disabled/hidden controls and recovers if focus is lost during redraw. Closing restores the original page opener through replacement dialogs, a matching control after rerender, or the page heading if the opener is gone. Route changes focus their new heading.

Evidence collected:

- Reproduced Enter on Conversation dropping focus outside the contact drawer before the fix. Initial focused Chromium checks pass for tabs/panels, text-field key isolation, input preservation on active-tab activation, focus containment, nested/replaced/missing openers, disabled pending-circle controls, and desktop/mobile focus indicators.
- Production build and all 84 unit/integration tests pass after the repairs. Desktop/mobile focused screenshots were inspected; existing portfolio layouts remain representative.
- Independent review found that capturing the opener after disabling/waiting can remember the wrong control. Reproduced Import opening after a slow draft save and returning to a Search field focused during the wait. Capture the actual trigger before disabling or awaiting, pass it explicitly to dialog helpers, and reject body/nonfocusable return targets. The delayed-opener regression now passes.
- The initial full run caught the native scroll-container focus case in a populated circle. Keep in-dialog native focus, explicitly label/focus the member list, and test scrolling followed by Tab to Cancel during saving. Expanded focused checks pass with eight synthetic contacts instead of an empty list.
- Review also caught offscreen heading focus after changing routes from a scrolled page. Reproduced it and allow heading focus to scroll into view; the dedicated browser regression passes. Independent re-review of the scoped repairs found no further issue.
- All focused keyboard checks, the build, 84 automated tests, and the complete Chromium suite pass on the final application code. Two earlier final-build runs timed out waiting for a periodic circle refresh and a toast dismissal. The circle checks passed in isolation; the complete suite then passed with idle sleep inhibited for the test process, without code, assertion, or timeout changes. The timeout causes remain unresolved. Publication is established separately by native Site success and the GitHub head.
- No server contract, applied migration, Site identity, audience, AI setting, or external integration changes. Tests use synthetic data only.

Pending person, circle, and reminder saves warn before unloading and block workspace switches/import confirmation until settled. Unsaved forms remain tab-memory only, and explicitly closing them still discards unsaved values. This is not form autosave, general conflict resolution, or crash recovery. Older open bundles retain their previous behavior until reloaded.

## Earlier Protections

- Reminder Set/Clear keeps the clicked person/time through draft autosave, preserves newer time and reply input on completion, and retains per-person pending locks. Demo persistence precedes in-memory replacement; calendar downloads do not wait for draft saves.
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
- Prior confirmed release: keyboard navigation, Site source `ef41e9b40f8c75b81c3f3d536319e606fe6498ea`, GitHub `584f399adf12b037faae8258ce177f1bbf354e63`, identical source tree `833aaa8a43ed410d699e25e7cba273d696a9104e`. This file records the import follow-up, not its own publication receipt.
- Open/synchronize and package via the Sites source helper. Use connected GitHub write tools if local push credentials are unavailable. Never put credentials, contact exports, or private data in GitHub.

## Limits And Next Useful Checks

- Same-field editing, imports racing with edits, and arbitrary out-of-order UI responses are not general conflict-resolved. The optional timestamp guard is not a unique revision and is not currently supplied by forms.
- Unsaved drafts/replies/forms can be lost on forced shutdown. Unload warnings are not guaranteed by every mobile lifecycle. Retry identities do not survive reloads or devices.
- Demo storage is browser-local, subject to eviction, and not cross-tab conflict-safe. Import, circle, and reminder saves use storage-before-state; other demo actions retain their existing best-effort behavior.
- Chromium checked; other engines, full screen-reader audit, and production D1 load/fault tests remain unverified. Keyboard/markup checks are not a claim of accessibility conformance or assistive-technology validation. Local import tests cover 10,000 contacts, one transactional batch, bounded query count, and injected rollback.
- Preserve browser failure diagnostics. Earlier intermittent toast/autosave timeouts were not reproduced in the previous final passes, but their root cause remains unknown.
- Preference and other action lifecycles remain separate. Reminder entry is not buffered across explicit tab changes, closing, or another action's redraw; failures after reopening ask the user to review the displayed time. Person/circle creation with a lost acknowledgement can still duplicate on retry; unlike message recording, creation has no retained idempotency key. Same-field edits remain last-write-wins.
- Real-user import and live AI preference/latency evaluation require authorization. No adoption, retention, writing-quality uplift, or production incident reduction is claimed.
