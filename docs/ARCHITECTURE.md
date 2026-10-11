# Architecture

## Two Runtimes, One Application

```mermaid
flowchart LR
  ZIP[Official LinkedIn ZIP] --> Parser[Browser-only extraction and preview]
  Parser --> API[Authenticated application requests]
  API --> DB[(SQLite locally / D1 hosted)]
  DB --> UI[Today / People / Circles / Inbox]
  UI --> Draft[Explicit draft request]
  Draft --> Model[OpenAI Responses API]
  UI --> User[User reviews and sends on LinkedIn]
  UI --> Calendar[Calendar reminder file]
```

- `web/`: rendering, keyboard/focus management, forms, separate demo state.
- `shared/`: data normalization, identity matching, ranking, calendar output, import parsing.
- `server/api.js`: authenticated operations, validation, owner scoping, request limits.
- `server/store.js`: relational storage with JSON records, transactional message-state updates.
- `server/node.mjs`: loopback development; protected HTTPS-origin production deployment.
- `server/worker.js`: hosted Sites identity headers, static assets, the same request handler.
- `scripts/build.mjs`: browser bundle plus a self-contained Worker and migration metadata.

A database is durable storage independent of the browser. This matters because losing a browser tab must not mean losing relationship context. SQLite keeps self-hosting simple; D1 removes disk management for the hosted version.

## Trust Boundaries

Owner ID is part of every private record query. Sites supplies validated identity; self-hosting is a single-owner password workspace. Local development binds only loopback and strips hosted identity headers. Mutation requests require the app's origin. Password sessions are signed, expiring, HttpOnly, Secure, and SameSite=Lax.

Only five static assets are served. There is no directory listing or route to local credentials. The optional model key never enters the browser. Demo state cannot write to the real workspace.

Message insertion and conversation-state updates share a transaction. Older replies cannot reopen a conversation answered more recently. Imports match stable identifiers and do not overwrite notes or circles for matching people. Backups merge, not replace.

## All-Or-Nothing Workspace Imports

`shared/import-validation.js` checks the whole backup in both browser preview and server processing. Malformed records, oversized collections, and messages without a resolvable contact reject the import rather than silently dropping history. The server resolves message contact IDs after identity matching and scopes that lookup to the current owner.

Contacts, new circles, historical messages, restored preferences, and the import receipt share one database batch. A transaction means those changes either all commit or all roll back. The local SQLite adapter explicitly rolls back on failure; hosted [D1 batches provide transactional rollback](https://developers.cloudflare.com/d1/worker-api/d1-database/). Restoring historical messages does not change the current reply state for matched contacts. Existing circle records and notification preferences remain unchanged.

Rows are packed into UTF-8 JSON parameters of at most 512 KiB, then inserted through `json_each`. This avoids one database request per contact. Two reads plus at most 45 write statements stay below the [D1 Free per-request query limit](https://developers.cloudflare.com/d1/platform/limits/). Larger prepared imports are rejected before writing. Tests cover a 10,000-contact synthetic import locally and an injected failure after every planned write; they do not constitute a production D1 load test.

The UI clears the old preview before reading another file, announces a persistent error, and ignores late results from a superseded selection or closed dialog.

## Conversation Entry Recovery

`web/reply-buffer.js` keeps unsaved message text and direction in memory, keyed by workspace and contact. Rendering the Conversation panel restores that entry. Each save captures the person, values, and edit revision; only an acknowledgement for unchanged input clears the buffer. A slow response preserves newer typing and its cursor, and finishing one person's save does not redraw another person's form. Per-person pending state blocks duplicate submissions even after the drawer is reopened.

Status is announced politely and linked to the message field. Reload/close requests trigger a browser unload warning while text or a save remains pending. Switching between private and demo workspaces redirects to an unsaved entry instead of discarding it; a confirmed import waits for outstanding message saves. No new browser-persistent cache or server autosave is introduced for these entries.

## Safe Message Retries

`web/message-recorder.js` assigns a random save identity to each recording attempt. An unchanged retry in the same tab keeps that identity until both the write and following state refresh succeed. Concurrent identical calls share one pending request. Changed text/direction after a failure or a new recording after confirmation gets a new identity; this is not permanent text deduplication. The helper is shared by Conversation saves and the manually recorded "I sent it" action.

The message endpoint accepts an optional UUID-v4 `requestId`. Existing clients without it still work but do not receive retry protection. New IDs are namespaced as `manual-<requestId>` in the existing owner-scoped message key; no migration or rewriting of historical messages is required.

The contact-state update runs only when that owner's message key does not exist, followed by insertion in the same transaction. A replay cannot reset later reminders, drafts, snoozes, or reply state. The server returns the stored record, including its original timestamp. Reusing an identity for different normalized content, direction, person, source, or supplied date returns a conflict instead of silently acknowledging another message. Local concurrent-request and rollback tests exercise the guard.

The receipt read uses the current ordinary D1 binding. Cloudflare documents that [queries without the Sessions API use the primary database](https://developers.cloudflare.com/d1/worker-api/d1-database/). Preserve read-after-write consistency if introducing read replicas later.

Limits: the browser's unconfirmed identity is tab-memory only. Reloading, changing the failed entry, or recording from another tab can create a distinct event. This is idempotency for a retained request identity, not universal exactly-once delivery. Nothing is sent externally. Browser tests drop a response after an actual temporary SQLite write and separately reject the following refresh; production D1 fault injection has not been performed.

## Recorded Send Completion

The "I sent it" handler captures the person, text, editor element, and draft revision before awaiting autosave. A per-person pending lock spans autosave, message recording, refresh, and draft cleanup. It survives drawer redraws and participates in unload warnings and workspace/import guards.

`web/draft-saver.js` retains a monotonic revision per contact after acknowledgement. A later edit, including changing text and changing it back, invalidates the old action's permission to clear it. If the message operation finishes after newer writing, the latest draft is re-queued because the outgoing-record operation clears the server draft. This also runs after a failed acknowledgement. The existing save queue retains that newer edit if its follow-up write fails.

Only an unchanged editor still present from the click can be closed after cleanup. New typing during the empty-draft save is checked again; unrelated forms are never redrawn by completion. Tests hold real local message writes and draft saves to exercise both sides of these timing boundaries.

This remains single-tab coordination, not an atomic message-plus-newer-draft transaction across clients. Forced shutdown between the message write and follow-up draft save can still lose newer writing. No schema, message endpoint, AI prompt, or applied migration changes are part of this iteration.

## Known Boundaries

This is not end-to-end encrypted. The hosting operator can access stored data. Protect backups and hosting access. Per-process request limiting is modest protection for an owner-private app, not a distributed anti-abuse system. Browser notifications require an open app; calendar alarms are delegated to the user's calendar. No scheduled LinkedIn sync exists.
