# Current State

Updated October 10, 2026. Scope: Relationship Copilot only.

## Product And Boundaries

- Dark personal workspace: Today, People, Circles, Inbox, Connections, Preferences.
- ZIP/CSV/pasted contacts with preview and stable-identity deduplication; shared-history circles; explainable shortlist; greeting-first drafts; manual reply tracking and calendar reminders.
- Persistent owner-scoped server storage; fictional demo isolated in the browser. Private Site audience is owner-only; the source repository is public.
- US owner, official LinkedIn access only. No live network/inbox sync, scraping, session-cookie access, brokers, or automatic sending. Personal-agent/export assistance requires fresh approval.
- Optional AI drafting is implemented but not live-evaluated. No-key mode is explicitly a local starter. No model/key changes in the recovery iteration.

## Latest Verified Change

Unchanged retries of a message recording now reuse a tab-memory save identity, covering both Conversation saves and "I sent it." If the original write succeeds but its acknowledgement or following refresh fails, retrying returns the original record instead of adding history. The server's transactional replay guard preserves later reminders, drafts, snoozes, and reply state. Conflicting identity reuse is rejected; old clients without an identity remain supported.

Evidence actually collected:

- Original API failure reproduced: retrying one identified recording added a second history entry.
- `npm test`: 48 passed, including six API/storage retry tests and five recorder tests plus the existing suite.
- `npm run build`: passed.
- `npm run test:browser`: passed across the existing desktop/tablet/mobile core journey plus actual local writes with dropped acknowledgements, reopening before retry, preserved later state, failed-refresh recovery, intentional repeated text, and manually recorded send retries.
- API/storage tests cover matching and conflicting concurrent calls, original receipts, owner isolation, identity validation, legacy requests, later state preservation, and transaction rollback when insertion fails.
- Layout is unchanged, so no new screenshot was needed. Existing recovery captures remain representative and use only synthetic data.
- No real LinkedIn data, paid AI calls, emails, or personal agents used.

Earlier draft protections remain in place: late suggestions cannot replace newer writing or redraw an unsaved reply form; duplicate generation requests are blocked. Retry retains the latest unsaved edit; copy/navigation work during save failures; unsaved changes trigger an unload warning. Builds clean generated output before packaging. Applied migrations remain unchanged.

Prior import safety remains in place: full validation, one transactional batch for all restored records and metadata, stable-ID matching, safe file-preview replacement, and rejection without partial changes. Reply buffers still preserve unsaved text/direction through reminder changes and navigation, with revision-aware clearing and unload warnings. This retry iteration changes the optional message API contract but not the schema or applied migrations.

## Deployment Context

- Existing Site identity is tracked in `.openai/hosting.json`; never replace it or broaden access without approval.
- App: https://relationship-copilot-amit.plumlyric7.chatgpt.site
- Public source: https://github.com/amit-dommeti/relationship-copilot
- The prior confirmed release is the October 10 reply-buffer fix: Site source `adfbe944ae2156c8c5a5aca06944406d7413eaec`, GitHub `28404d8138cbba7722ef09a9f977c3b3ad4aab5f`, identical source trees. This file records the tested retry-safety change; use the native Site deployment result and GitHub head to establish its publication, not this file alone.
- Use the Sites source helper to open/synchronize before edits and package the exact pushed source. Use connected GitHub write tools if local GitHub push credentials remain unavailable. Never store credentials or private contacts in the repository.

## Limits And Next Useful Checks

- Unsaved drafts and Conversation entries live in tab memory. Forced shutdown can lose them; unload warnings are not guaranteed on every mobile lifecycle event. Replies require explicit saving. Other unsaved forms, including reminder inputs, do not yet have equivalent buffers.
- Chromium checked; other engines and a full screen-reader audit remain unverified.
- Stale suggestions are discarded rather than merged. Invalidation does not guarantee cancellation of provider work or charges. A same-contact job remains pending until its request finishes or times out.
- These checks cover a single browser workspace session, not simultaneous editing across devices.
- Import rollback and size checks ran against local SQLite, not a hosted D1 load/fault-injection environment. The prepared batch is limited to 45 writes plus two reads. The request body is capped at 8 MiB; collections are capped at 10,000 contacts, 500 circles, and 10,000 messages, with rejection rather than silent truncation.
- Demo-mode imports still merge contacts/circles only, not full message/preferences restores. Investigate that preview/behavior mismatch in a future focused pass; the real-workspace restore is covered here.
- Retry identities survive failure and reopening within the same tab, not a reload or another device. Changing a failed entry starts a distinct recording. Review saved history before recording again after losing the tab; no universal exactly-once guarantee is claimed.
- Follow-up candidate: verify the "I sent it" completion path against newer composer typing during its pending save. Server replay safety does not by itself protect every later client-side clearing operation. Reproduce before changing behavior.
- Real-user import and live AI preference/latency evaluation still require authorization. No adoption, retention, or writing-quality uplift is claimed.
