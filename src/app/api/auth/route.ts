import { randomUUID, createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db, audit } from "@/features/auth/database";
import { hashPassword, verifyPassword } from "@/features/auth/password";
import { currentUser, endSession, hasAdmin, sameOrigin, startSession } from "@/features/auth/server";

const credentials = z.object({ email: z.email().max(254).transform(v => v.toLowerCase()), password: z.string().min(1).max(256) });
const strongPassword = z.string().min(12, "Use at least 12 characters.").max(256);
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
    db().prepare("UPDATE users SET password_hash=?,must_change_password=0 WHERE id=?").run(hash, user.id);
    db().prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
    audit(user.id, "password.changed", user.email);
    await startSession(user.id);
    return Response.json({ ok: true, next: "/" });
  }
  if (body.action === "setup") {
    const key = process.env.PORTAL_SETUP_KEY;
    if (!key || key.length < 24 || hasAdmin() || typeof body.setupKey !== "string" || !timingSafeEqual(sha(key), sha(body.setupKey)))
      return fail("Administrator setup is unavailable or the setup key is incorrect.", 403);
    const parsed = credentials.extend({ name: z.string().trim().min(2).max(100), password: strongPassword }).safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const hash = await hashPassword(parsed.data.password);
    const id = randomUUID();
    // Recheck inside the write transaction: only one request can bootstrap an admin.
    const database = db(); database.exec("BEGIN IMMEDIATE");
    try {
      if (hasAdmin()) { database.exec("ROLLBACK"); return fail("Administrator already exists.", 409); }
      database.prepare("INSERT INTO users VALUES (?,?,?,?,?,1,0,?)").run(id, parsed.data.name, parsed.data.email, hash, "admin", new Date().toISOString());
      audit(id, "admin.setup", parsed.data.email);
      database.exec("COMMIT");
    } catch (error) { database.exec("ROLLBACK"); throw error; }
    await startSession(id);
    return Response.json({ ok: true, next: "/admin/users" });
  }
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
  db().prepare("DELETE FROM login_attempts WHERE key=?").run(key);
  audit(String(row.id), "login", email);
  await startSession(String(row.id));
  return Response.json({ ok: true, next: row.must_change_password ? "/change-password" : "/" });
}
