import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Database } from "bun:sqlite";

const sourceDir = dirname(fileURLToPath(import.meta.url));
const defaultDataDir = join(sourceDir, "..", "data");

mkdirSync(defaultDataDir, { recursive: true });

const dbPath = process.env.AUTH_DB_PATH ?? join(defaultDataDir, "aura.sqlite");

export const db = new Database(dbPath, {
  create: true,
  strict: true,
});

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS resources_user_id_created_at_idx
    ON resources (user_id, created_at DESC);
`);
