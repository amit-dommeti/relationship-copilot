import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
export function openDatabase(filename) {
  if (filename !== ":memory:")
    mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  if (!db.prepare("SELECT name FROM sqlite_master WHERE name='contacts'").get())
    db.exec(
      readFileSync(
        new URL("../drizzle/0000_relationships.sql", import.meta.url),
        "utf8",
      ).replaceAll("--> statement-breakpoint", ""),
    );
  function prepare(sql) {
    return {
      bind(...args) {
        return {
          first: async () => db.prepare(sql).get(...args) || null,
          all: async () => ({ results: db.prepare(sql).all(...args) }),
          run: async () => db.prepare(sql).run(...args),
          _run: () => db.prepare(sql).run(...args),
        };
      },
    };
  }
  return {
    prepare,
    async batch(statements) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = statements.map((s) => s._run());
        db.exec("COMMIT");
        return result;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    close: () => db.close(),
  };
}
