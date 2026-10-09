# Deployment And Operations

## Private Hosted Site

The owner-specific Site is registered in `.openai/hosting.json`. Publishing packages `dist/server/index.js`, `dist/.openai/hosting.json`, and the migration journal/SQL under `dist/.openai/drizzle`.

Sites supplies managed sign-in and provisions the `DB` D1 binding. Every private record is scoped to the authenticated visitor. Keep this Site owner-private; a public GitHub repo does not imply a public contact database. Another owner must register their own Site rather than reuse this project's ID.

To publish a new version, build and test, synchronize the exact source commit through the Sites source workflow, and deploy its matching archive. Never put source credentials or API keys in the manifest.

Optional secret: `OPENAI_API_KEY`. Optional configuration: `OPENAI_MODEL=gpt-5.6-terra`. Without the key, starter drafts remain available. OpenAI Developers can assist key provisioning after its required approval; installing the plugin alone does not activate AI.

## Portable Node Hosting

```sh
npm ci
npm run build
NODE_ENV=production npm start
```

Supply privately:
- `APP_ORIGIN=https://your-domain.example`
- `APP_PASSWORD`: a unique password of at least 12 characters
- `SESSION_SECRET`: a random secret of at least 32 characters
- `DATA_DIR`: a persistent storage directory
- `PORT`: optional, defaults to 4173

TLS must terminate at your host or reverse proxy. Production refuses missing credentials or a non-HTTPS public origin. This mode is single-owner; don't use a shared password for a multi-user service.

## Docker

```sh
docker build -t relationship-copilot .
docker run --env-file .env.production -p 127.0.0.1:4173:4173 \
  -v copilot-data:/app/data relationship-copilot
```

Place a TLS reverse proxy in front. Container configuration is provided but has not been executed in this environment. The hosted Worker and Node flows have separate verification.

## Backups And Rollback

Use Preferences > Export backup before significant imports or upgrades. Backups contain private notes and messages; store them privately. Restoring is a merge and preserves existing relationship context for matches. Notification permissions are not restored.

For SQLite disaster recovery, use a consistent SQLite backup including its write-ahead log; do not copy just a live database file. D1 backup/restore is managed by the hosting platform. Re-deploying an older code version does not roll back stored data automatically.

No telemetry, outbound messaging automation, paid integration, or background LinkedIn job is enabled. Browser reminders run only while the app is open; import calendar files for calendar-managed alerts.
