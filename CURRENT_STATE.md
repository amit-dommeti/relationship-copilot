# Current State

Updated October 11, 2026. Scope: Relationship Copilot only.

## Product And Boundaries

- Dark personal workspace: Today, People, Circles, Inbox, Connections, Preferences.
- ZIP/CSV/pasted contacts with preview and stable-identity deduplication; shared-history circles; explainable shortlist; greeting-first drafts; manual reply tracking and calendar reminders.
- Persistent owner-scoped server storage; fictional demo isolated in the browser. Private Site audience is owner-only; the source repository is public.
- US owner, official LinkedIn access only. No live network/inbox sync, scraping, session-cookie access, brokers, or automatic sending. Personal-agent/export assistance requires fresh approval.
- Optional AI drafting is implemented but not live-evaluated. No-key mode is explicitly a local starter. No model/key changes in the recovery iteration.

## Latest Verified Change

Demo backup restores now include saved messages, circles, writing preferences, and import metadata, using the same preparation rules as the private workspace. Existing relationship context, identified history, notification settings, and demo capabilities remain protected. The preview explains the backup contents and demo-only destination. Browser storage must succeed before the in-memory demo is replaced; errors remain in the import dialog for retry.

Evidence actually collected:

- Original browser failure reproduced: Restore backup reported success but restored zero of one expected message in demo mode.
- `npm test`: 54 passed, including five new demo/private-store parity, repeated restore, non-mutation, contact-only, and legacy-backup tests. Existing transactional rollback, identity, query-bound, and owner-isolation tests remain passing.
- `npm run build`: passed.
- Focused Chromium restore check passed: complete history/preferences restore, reload persistence, repeat deduplication, orphan rejection, injected browser-storage failure/retry, and no private API writes or private-workspace changes.
- `npm run test:browser`: full core-journey suite passed across desktop/tablet/mobile, including the new demo restore and existing private restore checks.
- Inspected desktop/mobile backup preview captures. Added `assets/screenshots/v2/12-backup-preview.png` with synthetic data only.
- No real LinkedIn data, paid AI calls, emails, or personal agents used.

Earlier draft protections remain in place: late suggestions cannot replace newer writing or redraw an unsaved reply form; duplicate generation requests are blocked. Retry retains the latest unsaved edit; copy/navigation work during save failures; unsaved changes trigger an unload warning. Builds clean generated output before packaging. Applied migrations remain unchanged.

Prior import safety remains in place: full validation, one transactional batch for all restored records and metadata, stable-ID matching, safe file-preview replacement, and rejection without partial changes. Reply buffers preserve unsaved text/direction through reminder changes and navigation. Unchanged message retries retain their identity in the current tab and preserve later conversation state. Recorded-send completion protects newer writing and unrelated drawers. This iteration shares import preparation between server and demo without changing the message API, schema, applied migrations, or AI configuration.

## Deployment Context

- Existing Site identity is tracked in `.openai/hosting.json`; never replace it or broaden access without approval.
- App: https://relationship-copilot-amit.plumlyric7.chatgpt.site
- Public source: https://github.com/amit-dommeti/relationship-copilot
- The prior confirmed release is the October 10 sent-draft fix: Site source `dd16561402575edbd73231940ddb9b39328102ba`, GitHub `8f6081e995b8fc2162de9ca635116b6efac9bdbe`, identical source trees. This file records the tested demo-restore change; use the native Site deployment result and GitHub head to establish its publication, not this file alone.
- Use the Sites source helper to open/synchronize before edits and package the exact pushed source. Use connected GitHub write tools if local GitHub push credentials remain unavailable. Never store credentials or private contacts in the repository.

## Limits And Next Useful Checks

- Unsaved drafts and Conversation entries live in tab memory. Forced shutdown can lose them; unload warnings are not guaranteed on every mobile lifecycle event. Replies require explicit saving. Other unsaved forms, including reminder inputs, do not yet have equivalent buffers.
- Chromium checked; other engines and a full screen-reader audit remain unverified.
- Stale suggestions are discarded rather than merged. Invalidation does not guarantee cancellation of provider work or charges. A same-contact job remains pending until its request finishes or times out.
- These checks cover a single browser workspace session, not simultaneous editing across devices.
- Import rollback and size checks ran against local SQLite, not a hosted D1 load/fault-injection environment. The prepared batch is limited to 45 writes plus two reads. The request body is capped at 8 MiB; collections are capped at 10,000 contacts, 500 circles, and 10,000 messages, with rejection rather than silent truncation.
- Demo restore merges rather than replacing existing data. Demo persistence remains browser-local and can be cleared or evicted. The strict storage-before-state guarantee applies to imports; other demo edits retain their existing best-effort save behavior. Cross-tab storage conflicts are not resolved.
- Retry identities survive failure and reopening within the same tab, not a reload or another device. Changing a failed entry starts a distinct recording. Review saved history before recording again after losing the tab; no universal exactly-once guarantee is claimed.
- Preserving newer writing after an outgoing record uses a follow-up draft save, not one atomic transaction. Forced shutdown before that save, simultaneous clients, and a server write completing after the client has abandoned the request remain outside the tested guarantee. A server-side conditional draft-clear contract is a possible future hardening step; it requires separate contract/compatibility tests.
- Next useful safety check: reproduce the remaining storage-side draft-clear edge before changing the outgoing-message contract. Preserve the existing retry and state-ordering guarantees.
- Real-user import and live AI preference/latency evaluation still require authorization. No adoption, retention, or writing-quality uplift is claimed.
