# Current State

Updated October 10, 2026. Scope: Relationship Copilot only.

## Product And Boundaries

- Dark personal workspace: Today, People, Circles, Inbox, Connections, Preferences.
- ZIP/CSV/pasted contacts with preview and stable-identity deduplication; shared-history circles; explainable shortlist; greeting-first drafts; manual reply tracking and calendar reminders.
- Persistent owner-scoped server storage; fictional demo isolated in the browser. Private Site audience is owner-only; the source repository is public.
- US owner, official LinkedIn access only. No live network/inbox sync, scraping, session-cookie access, brokers, or automatic sending. Personal-agent/export assistance requires fresh approval.
- Optional AI drafting is implemented but not live-evaluated. No-key mode is explicitly a local starter. No model/key changes in the recovery iteration.

## Latest Verified Change

"I sent it" now captures the clicked person, text, and edit revision before autosave. A late completion preserves newer writing and its cursor, including text edited back to the same value. It cannot close another person's drawer or redraw an unrelated Conversation form. The per-person pending lock survives reopening and covers the complete recording/cleanup operation.

Evidence actually collected:

- Original browser failure reproduced: a slow recorded-send completion erased a newer, already-saved draft.
- `npm test`: 49 passed, including a new per-contact revision test plus all prior API/storage, import, retry, and buffer tests.
- `npm run build`: passed.
- `npm run test:browser`: passed across the existing desktop/tablet/mobile core journey. New checks cover newer typing/cursor, edited-back text, pending locks after reopening, unrelated forms, switching people before autosave finishes, typing during empty-draft cleanup, and a lost acknowledgement after an actual local write.
- Focused browser check also passed independently; inspected desktop/mobile pending-recording captures with synthetic data. No layout redesign, so existing committed portfolio screenshots remain representative.
- No real LinkedIn data, paid AI calls, emails, or personal agents used.

Earlier draft protections remain in place: late suggestions cannot replace newer writing or redraw an unsaved reply form; duplicate generation requests are blocked. Retry retains the latest unsaved edit; copy/navigation work during save failures; unsaved changes trigger an unload warning. Builds clean generated output before packaging. Applied migrations remain unchanged.

Prior import safety remains in place: full validation, one transactional batch for all restored records and metadata, stable-ID matching, safe file-preview replacement, and rejection without partial changes. Reply buffers still preserve unsaved text/direction through reminder changes and navigation. Unchanged message retries retain their identity in the current tab and preserve later conversation state. This iteration changes only browser coordination, not the message API, schema, applied migrations, or AI configuration.

## Deployment Context

- Existing Site identity is tracked in `.openai/hosting.json`; never replace it or broaden access without approval.
- App: https://relationship-copilot-amit.plumlyric7.chatgpt.site
- Public source: https://github.com/amit-dommeti/relationship-copilot
- The prior confirmed release is the October 10 retry-safety fix: Site source `c78b78ab507408f1e4f1842d795e5fda557fc693`, GitHub `43e8f7b15b3c63b9ba4afd181d430c00da9c94d4`, identical source trees. This file records the tested sent-draft protection; use the native Site deployment result and GitHub head to establish its publication, not this file alone.
- Use the Sites source helper to open/synchronize before edits and package the exact pushed source. Use connected GitHub write tools if local GitHub push credentials remain unavailable. Never store credentials or private contacts in the repository.

## Limits And Next Useful Checks

- Unsaved drafts and Conversation entries live in tab memory. Forced shutdown can lose them; unload warnings are not guaranteed on every mobile lifecycle event. Replies require explicit saving. Other unsaved forms, including reminder inputs, do not yet have equivalent buffers.
- Chromium checked; other engines and a full screen-reader audit remain unverified.
- Stale suggestions are discarded rather than merged. Invalidation does not guarantee cancellation of provider work or charges. A same-contact job remains pending until its request finishes or times out.
- These checks cover a single browser workspace session, not simultaneous editing across devices.
- Import rollback and size checks ran against local SQLite, not a hosted D1 load/fault-injection environment. The prepared batch is limited to 45 writes plus two reads. The request body is capped at 8 MiB; collections are capped at 10,000 contacts, 500 circles, and 10,000 messages, with rejection rather than silent truncation.
- Demo-mode imports still merge contacts/circles only, not full message/preferences restores. Investigate that preview/behavior mismatch in a future focused pass; the real-workspace restore is covered here.
- Retry identities survive failure and reopening within the same tab, not a reload or another device. Changing a failed entry starts a distinct recording. Review saved history before recording again after losing the tab; no universal exactly-once guarantee is claimed.
- Preserving newer writing after an outgoing record uses a follow-up draft save, not one atomic transaction. Forced shutdown before that save, simultaneous clients, and a server write completing after the client has abandoned the request remain outside the tested guarantee. A server-side conditional draft-clear contract is a possible future hardening step; it requires separate contract/compatibility tests.
- Next useful product check: reproduce the demo backup preview/restore mismatch before changing import behavior. Do not add unrelated features to this reliability pass.
- Real-user import and live AI preference/latency evaluation still require authorization. No adoption, retention, or writing-quality uplift is claimed.
