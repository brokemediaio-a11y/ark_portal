import { z } from "zod";
import { db, audit } from "@/features/auth/database";
import { apiAccess } from "@/features/auth/server";

export async function GET(request: Request) {
  const access = await apiAccess(request, "recovery"); if (access.response) return access.response;
  const requests = db().prepare(`SELECT r.*, u.name, u.email, u.role, u.active FROM password_reset_requests r
    JOIN users u ON u.id=r.user_id ORDER BY (r.status='pending') DESC,r.created_at DESC LIMIT 100`).all();
  return Response.json({ ok: true, requests }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function PATCH(request: Request) {
  const access = await apiAccess(request, "recovery"); if (access.response) return access.response;
  const parsed = z.object({ id: z.string().min(1), action: z.literal("dismiss") }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Choose a recovery request." }, { status: 400 });
  const database = db(); database.exec("BEGIN IMMEDIATE");
  try {
    const result = database.prepare("UPDATE password_reset_requests SET status='dismissed',handled_at=?,handled_by=? WHERE id=? AND status='pending'")
      .run(new Date().toISOString(), access.user.id, parsed.data.id);
    if (!result.changes) { database.exec("ROLLBACK"); return Response.json({ ok: false, error: "Pending request not found." }, { status: 404 }); }
    audit(access.user.id, "recovery.dismissed", parsed.data.id);
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
  return Response.json({ ok: true });
}
