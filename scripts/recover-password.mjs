// VPS-only recovery when no super administrator can sign in. No HTTP backdoor.
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { existsSync } from "node:fs";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) throw new Error("Usage: npm run auth:recover -- account@example.com");
const path = resolve(process.env.PORTAL_DATABASE_PATH || "data/portal.sqlite");
if (!existsSync(path)) throw new Error("Database not found. Run against the deployed application's environment and persistent database.");
const database = new DatabaseSync(path);
database.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
try {
  const user = database.prepare("SELECT id FROM users WHERE email=?").get(email);
  if (!user) throw new Error("Account not found.");
  const muted = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const input = createInterface({ input: process.stdin, output: muted, terminal: Boolean(process.stdin.isTTY) });
  let password; let confirmation;
  try {
    process.stdout.write("New temporary password (at least 12 characters): "); password = await input.question("");
    process.stdout.write("\nConfirm temporary password: "); confirmation = await input.question("");
    process.stdout.write("\n");
  } finally { input.close(); }
  if (password.length < 12 || password.length > 256) throw new Error("Use 12–256 characters.");
  if (password !== confirmation) throw new Error("Passwords do not match.");
  const salt = randomBytes(16).toString("hex");
  const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("UPDATE users SET password_hash=?,must_change_password=1 WHERE id=?").run(hash, user.id);
    database.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
    database.prepare("DELETE FROM login_attempts WHERE key=?").run(createHash("sha256").update(email).digest("hex"));
    if (database.prepare("SELECT name FROM sqlite_master WHERE name='password_reset_requests'").get())
      database.prepare("UPDATE password_reset_requests SET status='resolved',handled_at=?,handled_by=NULL WHERE user_id=? AND status='pending'").run(new Date().toISOString(), user.id);
    database.prepare("INSERT INTO audit (actor_id,action,subject,created_at) VALUES (NULL,'password.server_recovery',?,?)").run(email, new Date().toISOString());
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
  console.log(`Password reset for ${email}. Existing sessions are revoked. A new password is required on next sign-in.`);
} finally { database.close(); }
