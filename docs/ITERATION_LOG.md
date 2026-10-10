# Iteration Log

The v0 labels below are retrospective feature milestones, not independently validated releases or dated experiments.

## Draft recovery - October 10, 2026

- Reproduced a save failure in the browser: after a contact update returned 503, Copy message never reached the clipboard action. The failed promise also blocked other actions, and reopening the composer mislabeled the draft as saved.
- Replaced the single pending slot with a serial, per-contact save queue. Failed writes retain the latest edit for retry; a late response cannot erase a newer queued edit. Empty drafts are intentional writes too.
- Kept copying and read-only navigation available during outages. Added truthful save status, a keyboard-accessible retry control, polite status announcements, and a browser unload warning while drafts remain unsaved.
- Applied recovery to typed drafts, generated starters/variants, and clearing a sent draft. Workspace switching and replacing/exporting data still wait for pending saves.
- Verified 19 unit/integration tests, the production build, and Chromium product flows at desktop/tablet/mobile sizes. The browser regression covers failure, repeated failure, copying, tab/drawer navigation, retry without retyping, reload warning, persisted recovery, empty drafts, and a generated starter's failed save. Reviewed desktop/mobile captures; committed one synthetic-data recovery screenshot.
- Initial publication failed with `table contacts already exists`. Artifact inspection found a stale duplicate SQL file in generated output, not in source. Reproduced the packaging flaw locally and added clean-build output plus an isolated regression. Preserved the applied SQL, journal, database binding, and stored records unchanged.
- No durable offline cache was added. Browser crash/forced shutdown can still lose unsaved text; keep the tab open or copy the message. No live AI evaluation, LinkedIn access, or user outcome study was performed.
- Publication is confirmed by the Site deployment result and GitHub branch, not inferred from these local checks.

## v2.0 - October 9, 2026

- Rebuilt the dark workspace into Today, People, Circles, Inbox, Connections, and Preferences.
- Added direct ZIP import with preview, stable-identity matching, saved import metadata, backup restore, and preserved relationship notes.
- Added persistent owner-scoped storage, isolated demo data, cadence, snooze/undo, calendar reminders, draft persistence, and reply history.
- Replaced the proposed third-party sync route after the owner chose official-only access. Confirmed US location; personal portability is ineligible. No account connection or export was attempted.
- Added optional structured AI drafting with narrow context and explicit no-key starter mode. Model tests are mocked; live quality is not yet evaluated.
- Added portable Node/Docker and hosted Worker packaging, security tests, responsive browser checks, and real screenshots.
- Next experiment: one authorized real import, then three thoughtful messages in a week. No outcome is claimed yet.

## v0.1 Product Framing

- Defined target user, user problem, MVP, risks, and platform constraints.
- Chose local-first workflow because LinkedIn personal data access is restricted.

## v0.2 LinkedIn Import

- Added `Connections.csv` upload.
- Parsed imported name, company, position, URL, and connected date.
- Stored contacts in browser localStorage.

## v0.3 Weekly Recommendations

- Added local recommendation scoring.
- Ranked contacts by warmth, recency, message readiness, and status.
- Added optional AI recommendation endpoint with local fallback.

## v0.4 Dark Productivity UI

- Reworked the interface into a dark-mode productivity cockpit.
- Added dashboard metrics, recommendation cards, and stronger visual hierarchy.

## v0.5 Relationship Clusters

- Added clusters based on where the user knew people from.
- Auto-clustered imported contacts by company.
- Added cluster memory to reuse shared context across old coworkers.

## v0.6 Human Message Composer

- Replaced brittle template insertion.
- Added greeting-first messages.
- Rewrote third-person notes into second-person language.
- Added a smoke test for the Maya sample case.

## v0.7 Response Tracking

- Added reply capture and `needs reply` status.
- Added reminder date/time.
- Added browser notifications while the app is open.
- Added response cards to keep follow-through visible.
