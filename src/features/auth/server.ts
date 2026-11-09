import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./database";
import { can, type Permission, type PortalUser, type Role } from "./permissions";

const COOKIE = "ark_session";
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
export function publicUser(row: Record<string, unknown>): PortalUser {
  return { id: String(row.id), name: String(row.name), email: String(row.email), role: row.role as Role,
    active: Boolean(row.active), mustChangePassword: Boolean(row.must_change_password) };
}
export function hasAdmin() { return Boolean(db().prepare("SELECT id FROM users LIMIT 1").get()); }
export async function currentUser(): Promise<PortalUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = db().prepare(`SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id
    WHERE token_hash=? AND expires_at>? AND active=1`).get(digest(token), Date.now());
  return row ? publicUser(row) : null;
}
export async function requireUser(permission?: Permission) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  if (permission && !can(user.role, permission)) redirect("/access-denied");
  return user;
}
export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  db().prepare("DELETE FROM sessions WHERE expires_at<=?").run(Date.now());
  db().prepare("INSERT INTO sessions VALUES (?,?,?)").run(digest(token), userId, Date.now() + 8 * 3600_000);
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 8 * 3600 });
}
export async function endSession() {
  const jar = await cookies(); const token = jar.get(COOKIE)?.value;
  if (token) db().prepare("DELETE FROM sessions WHERE token_hash=?").run(digest(token));
  jar.delete(COOKIE);
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}
export async function apiAccess(request: Request, permission?: Permission, allowPasswordChange = false) {
  if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request))
    return { response: Response.json({ ok: false, error: "Invalid request origin." }, { status: 403 }) };
  const user = await currentUser();
  if (!user) return { response: Response.json({ ok: false, error: "Please sign in.", code: "unauthorized" }, { status: 401 }) };
  if ((!allowPasswordChange && user.mustChangePassword) || (permission && !can(user.role, permission)))
    return { response: Response.json({ ok: false, error: user.mustChangePassword ? "Change your temporary password first." : "Your role does not allow this action.", code: "forbidden" }, { status: 403 }) };
  return { user };
}
