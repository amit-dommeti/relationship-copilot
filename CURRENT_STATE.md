# Current State

Updated October 11, 2026. Scope: Relationship Copilot only.

## Product And Boundaries

- Dark personal workspace: Today, People, Circles, Inbox, Connections, Preferences.
- ZIP/CSV/pasted contacts with preview and stable-identity deduplication; shared-history circles; explainable shortlist; greeting-first drafts; manual reply tracking and calendar reminders.
- Persistent owner-scoped server storage; fictional demo isolated in the browser. Private Site audience is owner-only; the source repository is public.
- US owner, official LinkedIn access only. No live network/inbox sync, scraping, session-cookie access, brokers, or automatic sending. Personal-agent/export assistance requires fresh approval.
- Optional AI drafting is implemented but not live-evaluated. No-key mode is explicitly a local starter. No model/key changes in the recovery iteration.

## Latest Verified Change

The conditional-clear change below now passes the release checks, including two consecutive full browser runs on the final implementation. Publication is established by the native Site deployment result and GitHub head, not this file alone.

Recording a sent message clears only the matching saved draft version and text in the same transaction as the message. Newer saves, including identical-text edits, survive a delayed record without a follow-up browser repair. Conversation history entries leave the composer alone. The updated browser never issues an unconditional cleanup save and displays a newer remotely saved draft after refresh when no local edit superseded the action. A refresh also preserves text/version pairs acknowledged while its request was in flight, so the next send does not use a stale version.

Evidence actually collected:

- Original storage failure reproduced: recording an older outgoing message erased an already-saved newer draft before the browser could restore it.
- `npm test`: 60 passed, including five new draft-clear contract tests and one retry-guard test. Cases cover version/text matching, identical-text edits, optional/legacy guards, malformed input, historical events, rollback, replay, and preservation by default. Existing import, identity, query-bound, and owner-isolation tests remain passing.
- `npm run build`: passed.
- Final focused Chromium sent-draft check passed, including the reviewed follow-on fix: preservation before acknowledgement, changed-back text, lost confirmation without repair writes, a newer save simulated from another client, outgoing-history isolation, reload persistence, cursor/focus, and the next send after a delayed refresh plus metadata save.
- On the resumed October 11 pass, `npm test` (60 tests), the production build, and two consecutive complete `npm run test:browser` runs passed on the final implementation. Both browser runs covered desktop/tablet/mobile, import/demo restore, draft timing, reply recovery, message retries, and the reviewed stale-refresh/metadata-save/next-send case. No application code or test assertions/time limits changed between the earlier held candidate and these passes.
- Earlier verification history is retained: four full runs timed out on toast-dismissal or autosave waits after the review fix. A separate reply-buffer diagnostic passed, with its error timer firing after approximately nine seconds. Those timeouts did not recur in the two new full runs, but their cause is not established and is not claimed fixed. The runner retains visible-status/page-error logging and an ignored failure screenshot on errors.
- Inspected synthetic desktop/mobile pending-recording captures. No new layout or portfolio screenshot was needed.
- No real LinkedIn data, paid AI calls, emails, or personal agents used.

Earlier draft protections remain in place: late suggestions cannot replace newer writing or redraw an unsaved reply form; duplicate generation requests are blocked. Retry retains the latest unsaved edit; copy/navigation work during save failures; unsaved changes trigger an unload warning. Builds clean generated output before packaging. Applied migrations remain unchanged.

Prior import safety remains in place: full validation, one transactional batch for all restored records and metadata, stable-ID matching, safe file-preview replacement, and rejection without partial changes. Demo restore uses shared preparation for history, circles, preferences, and metadata, committing to browser storage before replacing its in-memory state. Reply buffers preserve unsaved text/direction through reminder changes and navigation. Unchanged message retries retain their identity and original clear guard in the current tab. This iteration adds an optional message API guard and JSON contact token, without changing applied migrations or AI configuration.

## Deployment Context

- Existing Site identity is tracked in `.openai/hosting.json`; never replace it or broaden access without approval.
- App: https://relationship-copilot-amit.plumlyric7.chatgpt.site
- Public source: https://github.com/amit-dommeti/relationship-copilot
- The prior confirmed release is the October 11 demo-restore fix: Site source `dba01d24b48fcdfd232087aba9d271347107d533`, GitHub `97a289abd5115372bea682b35f6a5fb4af7ac42c`, identical source trees. This file records the verified conditional-clear change; consult the native deployment result and GitHub head for its exact publication provenance.
- Use the Sites source helper to open/synchronize before edits and package the exact pushed source. Use connected GitHub write tools if local GitHub push credentials remain unavailable. Never store credentials or private contacts in the repository.

## Limits And Next Useful Checks

- Unsaved drafts and Conversation entries live in tab memory. Forced shutdown can lose them; unload warnings are not guaranteed on every mobile lifecycle event. Replies require explicit saving. Other unsaved forms, including reminder inputs, do not yet have equivalent buffers.
- Chromium checked; other engines and a full screen-reader audit remain unverified.
- Stale suggestions are discarded rather than merged. Invalidation does not guarantee cancellation of provider work or charges. A same-contact job remains pending until its request finishes or times out.
- The delayed-message check includes a separate simulated client's completed draft save. General simultaneous contact PATCH/import conflict resolution across devices remains unimplemented and unverified.
- Import rollback and size checks ran against local SQLite, not a hosted D1 load/fault-injection environment. The prepared batch is limited to 45 writes plus two reads. The request body is capped at 8 MiB; collections are capped at 10,000 contacts, 500 circles, and 10,000 messages, with rejection rather than silent truncation.
- Demo restore merges rather than replacing existing data. Demo persistence remains browser-local and can be cleared or evicted. The strict storage-before-state guarantee applies to imports; other demo edits retain their existing best-effort save behavior. Cross-tab storage conflicts are not resolved.
- Retry identities survive failure and reopening within the same tab, not a reload or another device. Changing a failed entry starts a distinct recording. Review saved history before recording again after losing the tab; no universal exactly-once guarantee is claimed.
- Server-side conditional clearing protects newer saved drafts without browser cleanup. Unsaved text still needs its own successful save. Already-open older browser bundles may retain the old cleanup behavior; reload after publication. Hosted D1 fault testing and forced OS/browser shutdown were not performed.
- Retain browser failure diagnostics if the unexplained timeouts recur; do not weaken checks to make them pass. A separate useful safety investigation is stale contact PATCH writes that can overwrite unrelated newer contact fields; general multi-device conflict handling is not part of this change.
- Real-user import and live AI preference/latency evaluation still require authorization. No adoption, retention, or writing-quality uplift is claimed.
