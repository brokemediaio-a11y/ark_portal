import { db, audit } from "@/features/auth/database";
import { apiAccess } from "@/features/auth/server";
import { can } from "@/features/auth/permissions";
import { quotationSchema } from "@/features/quotation/schema";
import { ticketSchema } from "@/features/ticket/schema";
import { z } from "zod";

type Context = { params: Promise<{ kind: string }> };
const fail = (error: string, status = 400) => Response.json({ ok: false, error }, { status });
const validKind = (kind: string) => kind === "quotations" || kind === "tickets";
export async function GET(request: Request, context: Context) {
  const access = await apiAccess(request, "documents"); if (access.response) return access.response;
  const { kind } = await context.params; if (!validKind(kind)) return fail("Not found.", 404);
  const rows = can(access.user.role, "team")
    ? db().prepare("SELECT body FROM documents WHERE kind=? ORDER BY updated_at DESC").all(kind)
    : db().prepare("SELECT body FROM documents WHERE kind=? AND owner_id=? ORDER BY updated_at DESC").all(kind, access.user.id);
  return Response.json({ ok: true, records: rows.map(row => JSON.parse(String(row.body))) }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function PUT(request: Request, context: Context) {
  const access = await apiAccess(request, "documents"); if (access.response) return access.response;
  const { kind } = await context.params; if (!validKind(kind)) return fail("Not found.", 404);
  const text = await request.text(); if (text.length > 2_000_000) return fail("Document is too large.", 413);
  const parsed = (kind === "quotations" ? quotationSchema : ticketSchema).safeParse((() => { try { return JSON.parse(text); } catch { return null; } })());
  if (!parsed.success) return fail("Document data is invalid.");
  const document = parsed.data;
  if (!z.uuid().safeParse(document.id).success) return fail("Document ID is invalid.");
  const existing = db().prepare("SELECT * FROM documents WHERE id=?").get(document.id);
  if (existing && (existing.kind !== kind || (existing.owner_id !== access.user.id && !can(access.user.role, "team")))) return fail("Document not found.", 404);
  const previous = existing ? JSON.parse(String(existing.body)) : null;
  if ("sourceType" in document && (document.sourceType === "flight_search" || ("providerSnapshot" in document && document.providerSnapshot)) && (!previous || previous.sourceType !== "flight_search") && !can(access.user.role, "flights"))
    return fail("Flight search access is required for this quotation.", 403);
  if (previous && "providerSnapshot" in document && JSON.stringify(previous.providerSnapshot) !== JSON.stringify(document.providerSnapshot))
    return fail("The original flight offer snapshot cannot be changed.", 403);
  const saved = { ...document, updatedAt: new Date().toISOString() };
  db().prepare(`INSERT INTO documents VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at`)
    .run(saved.id, kind, access.user.id, JSON.stringify(saved), saved.updatedAt);
  if (!existing) audit(access.user.id, `${kind}.created`, saved.id);
  return Response.json({ ok: true, record: saved }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function DELETE(request: Request, context: Context) {
  const access = await apiAccess(request, "delete"); if (access.response) return access.response;
  const { kind } = await context.params; if (!validKind(kind)) return fail("Not found.", 404);
  const body = await request.json().catch(() => null); if (typeof body?.id !== "string") return fail("Choose a document.");
  const existing = db().prepare("SELECT owner_id FROM documents WHERE id=? AND kind=?").get(body.id, kind);
  if (!existing || (existing.owner_id !== access.user.id && !can(access.user.role, "team"))) return fail("Document not found.", 404);
  db().prepare("DELETE FROM documents WHERE id=? AND kind=?").run(body.id, kind);
  audit(access.user.id, `${kind}.deleted`, body.id);
  return Response.json({ ok: true });
}
