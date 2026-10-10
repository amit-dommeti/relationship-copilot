# Current State

Updated October 10, 2026. Scope: Relationship Copilot only.

## Product And Boundaries

- Dark personal workspace: Today, People, Circles, Inbox, Connections, Preferences.
- ZIP/CSV/pasted contacts with preview and stable-identity deduplication; shared-history circles; explainable shortlist; greeting-first drafts; manual reply tracking and calendar reminders.
- Persistent owner-scoped server storage; fictional demo isolated in the browser. Private Site audience is owner-only; the source repository is public.
- US owner, official LinkedIn access only. No live network/inbox sync, scraping, session-cookie access, brokers, or automatic sending. Personal-agent/export assistance requires fresh approval.
- Optional AI drafting is implemented but not live-evaluated. No-key mode is explicitly a local starter. No model/key changes in the recovery iteration.

## Latest Verified Change

Slow draft suggestions cannot replace newer writing. Each request belongs to one contact in one workspace session. Editing a draft, changing intent, choosing a variant, recording a send, or saving new person/reply context invalidates the outstanding result. Workspace changes and confirmed imports discard old jobs. Loading state survives drawer/tab rendering; duplicate requests for the same contact are blocked. A background draft no longer redraws an unsaved Conversation form.

Evidence actually collected:

- Original browser failure reproduced: delayed simulated response overwrote a newer, already-saved handwritten draft.
- `npm test`: 24 passed, including five generation-lifecycle tests plus the earlier save queue, import, security, and clean-build tests.
- `npm run build`: passed.
- `npm run test:browser`: passed across the existing core journey plus delayed-response typing/cursor, intent, duplicate prevention, loading/error recovery, unrelated reply input, recorded sends, and workspace isolation.
- Desktop/mobile pending-state screenshots inspected. New source asset: `assets/screenshots/v2/09-draft-in-progress.png`, synthetic test data and simulated response only.
- No real LinkedIn data, paid AI calls, emails, or personal agents used.

Earlier draft recovery remains in place: retry retains the latest unsaved edit; copy/navigation work during save failures; unsaved changes trigger an unload warning. Builds clean generated output before packaging, preventing the stale duplicate SQL problem found in the prior release. Applied migrations remain unchanged.

## Deployment Context

- Existing Site identity is tracked in `.openai/hosting.json`; never replace it or broaden access without approval.
- App: https://relationship-copilot-amit.plumlyric7.chatgpt.site
- Public source: https://github.com/amit-dommeti/relationship-copilot
- The prior confirmed release is the October 10 recovery fix: Site source `f241a96b50eafb8e607dd9160d0eee83354d0290`, GitHub `be7a9c8eb406b2afddbda91da2da616d22b99c2d`, identical source trees. This file records the tested timing-safety change; use the native Site deployment result and GitHub head to establish its publication, not this file alone.
- Use the Sites source helper to open/synchronize before edits and package the exact pushed source. Use connected GitHub write tools if local GitHub push credentials remain unavailable. Never store credentials or private contacts in the repository.

## Limits And Next Useful Checks

- Unsaved drafts live in tab memory. Forced shutdown can lose them; unload warnings are not guaranteed on every mobile lifecycle event.
- Chromium checked; other engines and a full screen-reader audit remain unverified.
- Stale suggestions are discarded rather than merged. Invalidation does not guarantee cancellation of provider work or charges. A same-contact job remains pending until its request finishes or times out.
- These checks cover a single browser workspace session, not simultaneous editing across devices.
- Next candidate reliability check: verify malformed backups cannot partially change contacts before reporting an import error. Reproduce before changing behavior; no finding is claimed yet.
- Real-user import and live AI preference/latency evaluation still require authorization. No adoption, retention, or writing-quality uplift is claimed.
