import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db, audit } from "@/features/auth/database";
import { apiAccess } from "@/features/auth/server";

// No user-provided SQL or table names are interpolated into a query.
const tables = {
  users: "SELECT id,name,email,role,active,must_change_password,created_at FROM users ORDER BY created_at DESC",
  documents: "SELECT * FROM documents ORDER BY updated_at DESC",
  audit: "SELECT * FROM audit ORDER BY id DESC",
  password_reset_requests: "SELECT * FROM password_reset_requests ORDER BY created_at DESC",
  sessions: "SELECT user_id,expires_at FROM sessions ORDER BY expires_at DESC",
} as const;
export async function GET(request: Request) {
  const access = await apiAccess(request, "database"); if (access.response) return access.response;
  const params = new URL(request.url).searchParams;
  const table = params.get("table") || "users";
  const offset = Number(params.get("offset") || 0);
  if (!Object.hasOwn(tables, table) || !Number.isSafeInteger(offset) || offset < 0)
    return Response.json({ ok: false, error: "Choose a valid table and offset." }, { status: 400 });
  const counts = Object.fromEntries(Object.keys(tables).map(name => [name, Number(db().prepare(`SELECT COUNT(*) AS n FROM ${name}`).get()!.n)]));
  const rows = db().prepare(`${tables[table as keyof typeof tables]} LIMIT 50 OFFSET ?`).all(offset);
  audit(access.user.id, "database.viewed", table);
  return Response.json({ ok: true, table, offset, limit: 50, counts, rows }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(request: Request) {
  const access = await apiAccess(request, "database"); if (access.response) return access.response;
  const directory = await mkdtemp(join(tmpdir(), "ark-database-"));
  try {
    const path = join(directory, "portal.sqlite");
    audit(access.user.id, "database.backup", "SQLite snapshot downloaded");
    // VACUUM INTO creates a consistent, standalone snapshot, including committed WAL data.
    db().prepare("VACUUM INTO ?").run(path);
    const bytes = await readFile(path);
    return new Response(bytes, { headers: {
      "Content-Type": "application/vnd.sqlite3", "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="ark-portal-${new Date().toISOString().slice(0, 10)}.sqlite"`,
    } });
  } finally { await rm(directory, { recursive: true, force: true }); }
}
