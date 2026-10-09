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

## Known Boundaries

This is not end-to-end encrypted. The hosting operator can access stored data. Protect backups and hosting access. Per-process request limiting is modest protection for an owner-private app, not a distributed anti-abuse system. Browser notifications require an open app; calendar alarms are delegated to the user's calendar. No scheduled LinkedIn sync exists.
