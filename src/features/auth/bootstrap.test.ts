import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateUsers } from "./database";
import { seedAccounts } from "./bootstrap";

describe("existing database upgrade and bootstrap", () => {
  it("preserves account IDs, changed passwords, sessions, documents and foreign keys", () => {
    const path = join(mkdtempSync(join(tmpdir(), "ark-upgrade-")), "portal.sqlite");
    const database = new DatabaseSync(path);
    database.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('converter','agent','manager','admin')),
        active INTEGER NOT NULL DEFAULT 1, must_change_password INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
      INSERT INTO users VALUES ('existing','Existing Admin','info@arktravelers.com','changed-password-hash','admin',1,0,'2026-01-01');
      CREATE TABLE documents (id TEXT PRIMARY KEY, owner_id TEXT REFERENCES users(id), body TEXT);
      INSERT INTO documents VALUES ('doc','existing','preserved document');
      CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id));
      INSERT INTO sessions VALUES ('session','existing');
      CREATE TABLE audit (actor_id TEXT REFERENCES users(id), action TEXT);
      INSERT INTO audit VALUES ('existing','previous action');
      CREATE TABLE password_reset_requests (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE);
      INSERT INTO password_reset_requests VALUES ('request','existing');
      CREATE TABLE app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    try {
      migrateUsers(database); seedAccounts(database);
      expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      expect(database.prepare("SELECT * FROM users WHERE id='existing'").get()).toMatchObject({ password_hash: "changed-password-hash", must_change_password: 0 });
      expect(database.prepare("SELECT user_id FROM password_reset_requests").get()!.user_id).toBe("existing");
      expect(database.prepare("SELECT body FROM documents WHERE id='doc'").get()!.body).toBe("preserved document");
      expect(database.prepare("SELECT user_id FROM sessions").get()!.user_id).toBe("existing");
      expect(database.prepare("SELECT COUNT(*) AS n FROM users").get()!.n).toBe(2);
      database.prepare("UPDATE users SET password_hash='new-super-hash',must_change_password=0 WHERE role='super_admin'").run();
      migrateUsers(database); seedAccounts(database);
      expect(database.prepare("SELECT password_hash,must_change_password FROM users WHERE role='super_admin'").get()).toMatchObject({ password_hash: "new-super-hash", must_change_password: 0 });
      database.close();
      const reopened = new DatabaseSync(path);
      try {
        seedAccounts(reopened);
        expect(reopened.prepare("SELECT password_hash FROM users WHERE role='super_admin'").get()!.password_hash).toBe("new-super-hash");
        expect(reopened.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      } finally { reopened.close(); }
    } catch (error) { try { database.close(); } catch { /* Already closed. */ } throw error; }
  });
});
