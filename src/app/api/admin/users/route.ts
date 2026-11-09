import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, audit } from "@/features/auth/database";
import { apiAccess, publicUser } from "@/features/auth/server";
import { hashPassword, temporaryPassword } from "@/features/auth/password";

const profile = z.object({ name: z.string().trim().min(2).max(100), email: z.email().max(254).transform(v => v.toLowerCase()), role: z.enum(["converter", "agent", "manager", "admin"]) });
const fail = (error: string, status = 400) => Response.json({ ok: false, error }, { status });
export async function GET(request: Request) {
  const access = await apiAccess(request, "users"); if (access.response) return access.response;
  const users = db().prepare("SELECT * FROM users ORDER BY created_at DESC").all().map(publicUser);
  const activity = db().prepare("SELECT audit.*, users.name AS actor FROM audit LEFT JOIN users ON users.id=audit.actor_id ORDER BY audit.id DESC LIMIT 50").all();
  return Response.json({ ok: true, users, activity }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(request: Request) {
  const access = await apiAccess(request, "users"); if (access.response) return access.response;
  const parsed = profile.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const password = temporaryPassword(); const hash = await hashPassword(password); const id = randomUUID();
  try {
    db().prepare("INSERT INTO users VALUES (?,?,?,?,?,1,1,?)").run(id, parsed.data.name, parsed.data.email, hash, parsed.data.role, new Date().toISOString());
  } catch (error) {
    if (String(error).includes("UNIQUE")) return fail("An account with this email already exists.", 409);
    throw error;
  }
  audit(access.user.id, "user.created", `${parsed.data.email} (${parsed.data.role})`);
  return Response.json({ ok: true, temporaryPassword: password, email: parsed.data.email }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
export async function PATCH(request: Request) {
  const access = await apiAccess(request, "users"); if (access.response) return access.response;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string") return fail("Choose a user.");
  const row = db().prepare("SELECT * FROM users WHERE id=?").get(body.id);
  if (!row) return fail("User not found.", 404);
  if (body.action === "reset-password") {
    if (body.id === access.user.id) return fail("Change your own password from Account.");
    const password = temporaryPassword(); const hash = await hashPassword(password);
    db().prepare("UPDATE users SET password_hash=?,must_change_password=1 WHERE id=?").run(hash, body.id);
    db().prepare("DELETE FROM sessions WHERE user_id=?").run(body.id);
    audit(access.user.id, "user.password_reset", String(row.email));
    return Response.json({ ok: true, temporaryPassword: password, email: row.email }, { headers: { "Cache-Control": "no-store" } });
  }
  if (body.action !== "update") return fail("Unknown action.");
  const parsed = profile.extend({ active: z.boolean() }).safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, email, role, active } = parsed.data;
  if (body.id === access.user.id && (!active || role !== "admin")) return fail("You cannot disable or demote your own administrator account.");
  const database = db(); database.exec("BEGIN IMMEDIATE");
  try {
    const admins = Number(database.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND active=1").get()!.n);
    if (row.role === "admin" && row.active && (!active || role !== "admin") && admins <= 1) {
      database.exec("ROLLBACK"); return fail("Keep at least one active administrator.");
    }
    database.prepare("UPDATE users SET name=?,email=?,role=?,active=? WHERE id=?").run(name, email, role, Number(active), body.id);
    database.prepare("DELETE FROM sessions WHERE user_id=?").run(body.id);
    audit(access.user.id, "user.updated", `${email} (${role}, ${active ? "active" : "disabled"})`);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    if (String(error).includes("UNIQUE")) return fail("Email is already in use.", 409);
    throw error;
  }
  return Response.json({ ok: true });
}
