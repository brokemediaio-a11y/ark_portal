import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { db, audit } from "@/features/auth/database";
import { apiAccess, publicUser } from "@/features/auth/server";
import { hashPassword, strongPassword } from "@/features/auth/password";

const profile = z.object({ name: z.string().trim().min(2).max(100), email: z.email().max(254).transform(v => v.toLowerCase()), role: z.enum(["converter", "agent", "manager", "admin", "super_admin"]) });
const fail = (error: string, status = 400) => Response.json({ ok: false, error }, { status });
export async function GET(request: Request) {
  const access = await apiAccess(request, "users"); if (access.response) return access.response;
  const users = db().prepare("SELECT * FROM users ORDER BY created_at DESC").all().map(publicUser);
  const activity = db().prepare("SELECT audit.*, users.name AS actor FROM audit LEFT JOIN users ON users.id=audit.actor_id ORDER BY audit.id DESC LIMIT 50").all();
  return Response.json({ ok: true, users, activity }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(request: Request) {
  const access = await apiAccess(request, "users"); if (access.response) return access.response;
  const parsed = profile.extend({ password: strongPassword }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  if (parsed.data.role === "super_admin" && access.user.role !== "super_admin") return fail("Only the development team can create super administrators.", 403);
  const hash = await hashPassword(parsed.data.password); const id = randomUUID();
  const freshAccess = await apiAccess(request, "users"); if (freshAccess.response) return freshAccess.response;
  if (parsed.data.role === "super_admin" && freshAccess.user.role !== "super_admin") return fail("Only the development team can create super administrators.", 403);
  try {
    db().prepare("INSERT INTO users VALUES (?,?,?,?,?,1,1,?)").run(id, parsed.data.name, parsed.data.email, hash, parsed.data.role, new Date().toISOString());
  } catch (error) {
    if (String(error).includes("UNIQUE")) return fail("An account with this email already exists.", 409);
    throw error;
  }
  audit(access.user.id, "user.created", `${parsed.data.email} (${parsed.data.role})`);
  return Response.json({ ok: true, email: parsed.data.email }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
export async function PATCH(request: Request) {
  const access = await apiAccess(request, "users"); if (access.response) return access.response;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string") return fail("Choose a user.");
  const row = db().prepare("SELECT * FROM users WHERE id=?").get(body.id);
  if (!row) return fail("User not found.", 404);
  const superAdmin = access.user.role === "super_admin";
  if (row.role === "super_admin" && !superAdmin) return fail("Only the development team can manage super administrators.", 403);
  if (body.action === "reset-password") {
    if (body.id === access.user.id && !superAdmin) return fail("Change your own password from Settings.");
    const parsed = strongPassword.safeParse(body.password);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const hash = await hashPassword(parsed.data);
    const freshAccess = await apiAccess(request, "users"); if (freshAccess.response) return freshAccess.response;
    const database = db(); database.exec("BEGIN IMMEDIATE");
    try {
      const latest = database.prepare("SELECT role,email FROM users WHERE id=?").get(body.id);
      if (!latest) { database.exec("ROLLBACK"); return fail("User not found.", 404); }
      if ((latest.role === "super_admin" && freshAccess.user.role !== "super_admin") || (body.id === freshAccess.user.id && freshAccess.user.role !== "super_admin")) {
        database.exec("ROLLBACK"); return fail("You cannot reset this account's password.", 403);
      }
      database.prepare("UPDATE users SET password_hash=?,must_change_password=1 WHERE id=?").run(hash, body.id);
      database.prepare("DELETE FROM sessions WHERE user_id=?").run(body.id);
      database.prepare("DELETE FROM login_attempts WHERE key=?").run(createHash("sha256").update(String(latest.email)).digest("hex"));
      database.prepare("UPDATE password_reset_requests SET status='resolved',handled_at=?,handled_by=? WHERE user_id=? AND status='pending'")
        .run(new Date().toISOString(), access.user.id, body.id);
      audit(access.user.id, "user.password_reset", String(row.email));
      database.exec("COMMIT");
    } catch (error) { database.exec("ROLLBACK"); throw error; }
    return Response.json({ ok: true, email: row.email, ...(body.id === access.user.id ? { next: "/login" } : {}) }, { headers: { "Cache-Control": "no-store" } });
  }
  if (body.action !== "update") return fail("Unknown action.");
  const parsed = profile.extend({ active: z.boolean() }).safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, email, role, active } = parsed.data;
  if (role === "super_admin" && !superAdmin) return fail("Only the development team can assign this role.", 403);
  if (body.id === access.user.id && (!active || role !== access.user.role)) return fail("You cannot disable or demote your own account.");
  const database = db(); database.exec("BEGIN IMMEDIATE");
  try {
    if (row.active && (!active || role !== row.role)) {
      if (row.role === "super_admin" && Number(database.prepare("SELECT COUNT(*) AS n FROM users WHERE role='super_admin' AND active=1").get()!.n) <= 1) {
        database.exec("ROLLBACK"); return fail("Keep at least one active super administrator.");
      }
      if (row.role === "admin" && !superAdmin && Number(database.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND active=1").get()!.n) <= 1) {
        database.exec("ROLLBACK"); return fail("Keep at least one active administrator.");
      }
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
  return Response.json({ ok: true, ...(body.id === access.user.id ? { next: "/login" } : {}) });
}
export async function DELETE(request: Request) {
  const access = await apiAccess(request, "database"); if (access.response) return access.response;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string") return fail("Choose a user.");
  if (body.id === access.user.id) return fail("You cannot delete your own account.");
  const database = db(); database.exec("BEGIN IMMEDIATE");
  try {
    const user = database.prepare("SELECT * FROM users WHERE id=?").get(body.id);
    if (!user) { database.exec("ROLLBACK"); return fail("User not found.", 404); }
    if (user.role === "super_admin" && user.active && Number(database.prepare("SELECT COUNT(*) AS n FROM users WHERE role='super_admin' AND active=1").get()!.n) <= 1) {
      database.exec("ROLLBACK"); return fail("Keep at least one active super administrator.");
    }
    database.prepare("DELETE FROM sessions WHERE user_id=?").run(body.id);
    database.prepare("DELETE FROM documents WHERE owner_id=?").run(body.id);
    database.prepare("UPDATE audit SET actor_id=NULL WHERE actor_id=?").run(body.id);
    database.prepare("DELETE FROM users WHERE id=?").run(body.id);
    audit(access.user.id, "user.deleted", String(user.email));
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
  return Response.json({ ok: true });
}
