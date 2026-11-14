import { createHash } from "node:crypto";
import { z } from "zod";
import { requestRecovery } from "@/features/auth/recovery";
import { db, audit } from "@/features/auth/database";
import { hashPassword, strongPassword, verifyPassword } from "@/features/auth/password";
import { currentUser, endSession, sameOrigin, startSession } from "@/features/auth/server";

const credentials = z.object({ email: z.email().max(254).transform(v => v.toLowerCase()), password: z.string().min(1).max(256) });
const fail = (error: string, status = 400) => Response.json({ ok: false, error }, { status });
const sha = (s: string) => createHash("sha256").update(s).digest();

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("Invalid request origin.", 403);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return fail("Invalid request.");
  if (body.action === "logout") { await endSession(); return Response.json({ ok: true }); }
  if (body.action === "change-password") {
    const user = await currentUser();
    if (!user) return fail("Please sign in.", 401);
    const parsed = z.object({ currentPassword: z.string().min(1).max(256), password: strongPassword }).safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const row = db().prepare("SELECT password_hash FROM users WHERE id=?").get(user.id)!;
    if (!await verifyPassword(parsed.data.currentPassword, String(row.password_hash))) return fail("Current password is incorrect.");
    if (parsed.data.currentPassword === parsed.data.password) return fail("Choose a different password.");
    const hash = await hashPassword(parsed.data.password);
    const database = db(); database.exec("BEGIN IMMEDIATE");
    try {
      // A concurrent reset must not be overwritten using an old password/session.
      const changed = database.prepare("UPDATE users SET password_hash=?,must_change_password=0 WHERE id=? AND password_hash=?")
        .run(hash, user.id, row.password_hash);
      if (!changed.changes) { database.exec("ROLLBACK"); return fail("Your password changed. Please sign in again.", 409); }
      database.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
      database.prepare("UPDATE password_reset_requests SET status='resolved',handled_at=?,handled_by=? WHERE user_id=? AND status='pending'")
        .run(new Date().toISOString(), user.id, user.id);
      audit(user.id, "password.changed", user.email);
      database.exec("COMMIT");
    } catch (error) { database.exec("ROLLBACK"); throw error; }
    await startSession(user.id);
    return Response.json({ ok: true, next: "/" });
  }
  if (body.action === "setup") return fail("Public registration is disabled. Contact your administrator.", 403);
  if (body.action === "forgot-password") return requestRecovery(request, body);
  if (body.action !== "login") return fail("Unknown action.");
  const parsed = credentials.safeParse(body);
  if (!parsed.success) return fail("Enter your email and password.");
  const { email, password } = parsed.data;
  const key = sha(email).toString("hex"); const now = Date.now();
  db().prepare("DELETE FROM login_attempts WHERE reset_at<=?").run(now);
  const attempt = db().prepare("SELECT count FROM login_attempts WHERE key=?").get(key);
  if (attempt && Number(attempt.count) >= 8) return fail("Too many attempts. Try again in 15 minutes.", 429);
  db().prepare(`INSERT INTO login_attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1`).run(key, now + 15 * 60_000);
  const row = db().prepare("SELECT * FROM users WHERE email=?").get(email);
  // Do equally expensive work for nonexistent users to avoid a cheap timing oracle.
  const valid = await verifyPassword(password, row ? String(row.password_hash) : `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`);
  if (!row || !valid || !row.active) return fail("Email or password is incorrect.", 401);
  const latest = db().prepare("SELECT * FROM users WHERE id=? AND password_hash=? AND active=1").get(row.id, row.password_hash);
  if (!latest) return fail("Email or password is incorrect.", 401);
  db().prepare("DELETE FROM login_attempts WHERE key=?").run(key);
  audit(String(row.id), "login", email);
  await startSession(String(row.id));
  return Response.json({ ok: true, next: latest.must_change_password ? "/change-password" : "/" });
}
