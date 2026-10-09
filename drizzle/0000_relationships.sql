CREATE TABLE contacts (owner TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (owner, id));
--> statement-breakpoint
CREATE TABLE circles (owner TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (owner, id));
--> statement-breakpoint
CREATE TABLE messages (owner TEXT NOT NULL, id TEXT NOT NULL, contact_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (owner, id));
--> statement-breakpoint
CREATE TABLE settings (owner TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX message_contact ON messages(owner, contact_id, created_at);
