# Current State

Updated October 10, 2026. Scope: Relationship Copilot only.

## Product And Boundaries

- Dark personal workspace: Today, People, Circles, Inbox, Connections, Preferences.
- ZIP/CSV/pasted contacts with preview and stable-identity deduplication; shared-history circles; explainable shortlist; greeting-first drafts; manual reply tracking and calendar reminders.
- Persistent owner-scoped server storage; fictional demo isolated in the browser. Private Site audience is owner-only; the source repository is public.
- US owner, official LinkedIn access only. No live network/inbox sync, scraping, session-cookie access, brokers, or automatic sending. Personal-agent/export assistance requires fresh approval.
- Optional AI drafting is implemented but not live-evaluated. No-key mode is explicitly a local starter. No model/key changes in the recovery iteration.

## Latest Verified Change

Draft recovery retains each contact's latest unsaved edit until a successful response. Copying and read-only navigation do not wait on a broken save. The composer reports real save state, offers retry, and warns before unloading while edits remain. Generated drafts and empty-draft writes use the same queue. Workspace switching and data replacement still require successful pending saves.

Evidence actually collected:

- Original browser failure reproduced: injected 503 prevented Copy message from running.
- `npm test`: 19 passed, including five queue tests for failures, retry, coalescing, multiple contacts, and edits arriving during an in-flight write, plus an isolated clean-build regression.
- `npm run build`: passed.
- `npm run test:browser`: passed across the existing core journey plus outage recovery, navigation, reload warning, persisted retry, empty drafts, and generated starter recovery.
- Desktop/mobile recovery screenshots inspected. Published-source asset: `assets/screenshots/v2/08-draft-recovery.png`, synthetic test data only.
- No real LinkedIn data, paid AI calls, emails, or personal agents used.

The first publication attempt failed because stale generated output contained a duplicate SQL file (`0000_relationships 2.sql`). The original source migration was unchanged. Reproduced stale-file retention in an isolated build fixture, then fixed the build to clean its generated `dist` directory first. The regression verifies stale files are excluded and source SQL is copied byte-for-byte. No database schema/history was rewritten and no records were deleted.

## Deployment Context

- Existing Site identity is tracked in `.openai/hosting.json`; never replace it or broaden access without approval.
- App: https://relationship-copilot-amit.plumlyric7.chatgpt.site
- Public source: https://github.com/amit-dommeti/relationship-copilot
- The latest confirmed release before this iteration was the October 9 v2 rebuild. This file records the tested recovery change; use the native Site deployment result and GitHub head to establish publication, not this file alone.
- Use the Sites source helper to open/synchronize before edits and package the exact pushed source. Use connected GitHub write tools if local GitHub push credentials remain unavailable. Never store credentials or private contacts in the repository.

## Limits And Next Useful Checks

- Unsaved drafts live in tab memory. Forced shutdown can lose them; unload warnings are not guaranteed on every mobile lifecycle event.
- Chromium checked; other engines and a full screen-reader audit remain unverified.
- Potential next reliability check: reproduce what happens if someone edits a message or switches workspaces while generation is still in flight. No claim that this separate race is fixed.
- Real-user import and live AI preference/latency evaluation still require authorization. No adoption, retention, or writing-quality uplift is claimed.
