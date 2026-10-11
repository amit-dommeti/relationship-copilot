# Current State

Updated October 10, 2026. Scope: Relationship Copilot only.

## Product And Boundaries

- Dark personal workspace: Today, People, Circles, Inbox, Connections, Preferences.
- ZIP/CSV/pasted contacts with preview and stable-identity deduplication; shared-history circles; explainable shortlist; greeting-first drafts; manual reply tracking and calendar reminders.
- Persistent owner-scoped server storage; fictional demo isolated in the browser. Private Site audience is owner-only; the source repository is public.
- US owner, official LinkedIn access only. No live network/inbox sync, scraping, session-cookie access, brokers, or automatic sending. Personal-agent/export assistance requires fresh approval.
- Optional AI drafting is implemented but not live-evaluated. No-key mode is explicitly a local starter. No model/key changes in the recovery iteration.

## Latest Verified Change

Real-workspace imports are now all-or-nothing. Complete backup validation precedes writes; contacts, circles, historical messages, restored preferences, and import metadata share one transactional batch. Invalid messages, orphaned contact references, or a storage failure leave the old records unchanged. Choosing another file clears the old confirmation; late file reads cannot replace the current selection.

Evidence actually collected:

- Original API failure reproduced: a malformed backup message caused a rejected import to change an existing contact's company.
- `npm test`: 31 passed, including seven import-safety tests plus prior generation, save queue, security, and clean-build tests.
- `npm run build`: passed.
- `npm run test:browser`: passed across the existing core journey plus invalid-file replacement, late file reads, server rejection without mutations, corrected full-backup restore, and reload persistence.
- Local tests verify complete rollback after an injected failure, stable-ID repeat imports, owner isolation, preservation of current relationship context, and a 10,000-contact import in one batch with bounded query/parameter sizes.
- Desktop/mobile error-state screenshots inspected. New source asset: `assets/screenshots/v2/10-import-safety.png`, synthetic data only.
- No real LinkedIn data, paid AI calls, emails, or personal agents used.

Earlier draft protections remain in place: late suggestions cannot replace newer writing or redraw an unsaved reply form; duplicate generation requests are blocked. Retry retains the latest unsaved edit; copy/navigation work during save failures; unsaved changes trigger an unload warning. Builds clean generated output before packaging. Applied migrations remain unchanged.

## Deployment Context

- Existing Site identity is tracked in `.openai/hosting.json`; never replace it or broaden access without approval.
- App: https://relationship-copilot-amit.plumlyric7.chatgpt.site
- Public source: https://github.com/amit-dommeti/relationship-copilot
- The prior confirmed release is the October 10 draft-timing fix: Site source `3ebc815ed76863f9867f2917444f5c4d0caa8485`, GitHub `46b4d9b269272a8b07a30d10be98a1866ae916ea`, identical source trees. This file records the tested import-safety change; use the native Site deployment result and GitHub head to establish its publication, not this file alone.
- Use the Sites source helper to open/synchronize before edits and package the exact pushed source. Use connected GitHub write tools if local GitHub push credentials remain unavailable. Never store credentials or private contacts in the repository.

## Limits And Next Useful Checks

- Unsaved drafts live in tab memory. Forced shutdown can lose them; unload warnings are not guaranteed on every mobile lifecycle event.
- Chromium checked; other engines and a full screen-reader audit remain unverified.
- Stale suggestions are discarded rather than merged. Invalidation does not guarantee cancellation of provider work or charges. A same-contact job remains pending until its request finishes or times out.
- These checks cover a single browser workspace session, not simultaneous editing across devices.
- Import rollback and size checks ran against local SQLite, not a hosted D1 load/fault-injection environment. The prepared batch is limited to 45 writes plus two reads. The request body is capped at 8 MiB; collections are capped at 10,000 contacts, 500 circles, and 10,000 messages, with rejection rather than silent truncation.
- Demo-mode imports still merge contacts/circles only, not full message/preferences restores. Investigate that preview/behavior mismatch in a future focused pass; the real-workspace restore is covered here.
- Real-user import and live AI preference/latency evaluation still require authorization. No adoption, retention, or writing-quality uplift is claimed.
