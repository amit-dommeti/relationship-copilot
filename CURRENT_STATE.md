# Current State

Updated October 10, 2026. Scope: Relationship Copilot only.

## Product And Boundaries

- Dark personal workspace: Today, People, Circles, Inbox, Connections, Preferences.
- ZIP/CSV/pasted contacts with preview and stable-identity deduplication; shared-history circles; explainable shortlist; greeting-first drafts; manual reply tracking and calendar reminders.
- Persistent owner-scoped server storage; fictional demo isolated in the browser. Private Site audience is owner-only; the source repository is public.
- US owner, official LinkedIn access only. No live network/inbox sync, scraping, session-cookie access, brokers, or automatic sending. Personal-agent/export assistance requires fresh approval.
- Optional AI drafting is implemented but not live-evaluated. No-key mode is explicitly a local starter. No model/key changes in the recovery iteration.

## Latest Verified Change

Unsaved Conversation entries now stay attached to their person. Setting a reminder, switching tabs, and closing/reopening the drawer preserve message text and direction. Failed saves retain the entry. Each save captures its person and edit revision, so a slow acknowledgement cannot clear newer typing or redraw another person's form. Pending state survives navigation and blocks duplicate submission while the request is outstanding.

Evidence actually collected:

- Original browser failure reproduced: setting a reminder cleared the unsaved reply in the same Conversation panel.
- `npm test`: 37 passed, including six reply-buffer tests plus the prior import, generation, save queue, security, and clean-build tests.
- `npm run build`: passed.
- `npm run test:browser`: passed across the existing core journey plus reminder preservation, tabs/reopening, person isolation, pending duplicate prevention, controlled failure/retry, newer typing/cursor preservation, reload warning, workspace-switch guard, and unrelated form preservation.
- Buffer tests verify workspace/person isolation, failure recovery, revision-aware acknowledgement, empty edits, and stale completions. Failed-save browser tests reject before the database write; lost-response retries are not covered.
- Desktop/mobile error-state screenshots inspected. New source asset: `assets/screenshots/v2/11-reply-recovery.png`, synthetic data only.
- No real LinkedIn data, paid AI calls, emails, or personal agents used.

Earlier draft protections remain in place: late suggestions cannot replace newer writing or redraw an unsaved reply form; duplicate generation requests are blocked. Retry retains the latest unsaved edit; copy/navigation work during save failures; unsaved changes trigger an unload warning. Builds clean generated output before packaging. Applied migrations remain unchanged.

Prior import safety remains in place: full validation, one transactional batch for all restored records and metadata, stable-ID matching, safe file-preview replacement, and rejection without partial changes. No storage or server API changes were needed for this reply-buffer iteration.

## Deployment Context

- Existing Site identity is tracked in `.openai/hosting.json`; never replace it or broaden access without approval.
- App: https://relationship-copilot-amit.plumlyric7.chatgpt.site
- Public source: https://github.com/amit-dommeti/relationship-copilot
- The prior confirmed release is the October 10 import-safety fix: Site source `d092ef9e4c89e75056c0e4831d5ebb3c191cf55a`, GitHub `af59dc87aaab4012f5b2db7314e74e1ec25e688b`, identical source trees. This file records the tested reply-buffer change; use the native Site deployment result and GitHub head to establish its publication, not this file alone.
- Use the Sites source helper to open/synchronize before edits and package the exact pushed source. Use connected GitHub write tools if local GitHub push credentials remain unavailable. Never store credentials or private contacts in the repository.

## Limits And Next Useful Checks

- Unsaved drafts and Conversation entries live in tab memory. Forced shutdown can lose them; unload warnings are not guaranteed on every mobile lifecycle event. Replies require explicit saving. Other unsaved forms, including reminder inputs, do not yet have equivalent buffers.
- Chromium checked; other engines and a full screen-reader audit remain unverified.
- Stale suggestions are discarded rather than merged. Invalidation does not guarantee cancellation of provider work or charges. A same-contact job remains pending until its request finishes or times out.
- These checks cover a single browser workspace session, not simultaneous editing across devices.
- Import rollback and size checks ran against local SQLite, not a hosted D1 load/fault-injection environment. The prepared batch is limited to 45 writes plus two reads. The request body is capped at 8 MiB; collections are capped at 10,000 contacts, 500 circles, and 10,000 messages, with rejection rather than silent truncation.
- Demo-mode imports still merge contacts/circles only, not full message/preferences restores. Investigate that preview/behavior mismatch in a future focused pass; the real-workspace restore is covered here.
- Next message-safety candidate: verify a server write followed by a lost response and retry. The API currently assigns a new message ID per request, so preventing concurrent duplicate clicks is not an exactly-once recording guarantee. Reproduce that ambiguity before changing the request contract.
- Real-user import and live AI preference/latency evaluation still require authorization. No adoption, retention, or writing-quality uplift is claimed.
