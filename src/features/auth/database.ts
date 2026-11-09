import "server-only";
import { DatabaseSync } from "node:sqlite";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

let instance: DatabaseSync | undefined;
export function db() {
  if (instance) return instance;
  // Runtime data belongs on the VPS disk; it must never be traced into build output.
  const path = resolve(/* turbopackIgnore: true */ process.env.PORTAL_DATABASE_PATH || "data/portal.sqlite");
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  instance = new DatabaseSync(path);
  chmodSync(path, 0o600);
  instance.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('converter','agent','manager','admin')),
      active INTEGER NOT NULL DEFAULT 1, must_change_password INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('quotations','tickets')),
      owner_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS documents_owner ON documents(owner_id, kind);
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY, actor_id TEXT REFERENCES users(id), action TEXT NOT NULL,
      subject TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
  `);
  return instance;
}
export function audit(actor: string | null, action: string, subject: string) {
  db().prepare("INSERT INTO audit (actor_id,action,subject,created_at) VALUES (?,?,?,?)")
    .run(actor, action, subject, new Date().toISOString());
}
