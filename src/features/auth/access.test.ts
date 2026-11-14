import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => jar.has(name) ? { value: jar.get(name) } : undefined,
  set: (name: string, value: string) => jar.set(name, value), delete: (name: string) => jar.delete(name),
}) }));

import { POST as auth } from "@/app/api/auth/route";
import { GET as users, POST as createUser, PATCH as updateUser, DELETE as removeUser } from "@/app/api/admin/users/route";
import { GET as documents, PUT as saveDocument, DELETE as deleteDocument } from "@/app/api/documents/[kind]/route";
import { POST as searchFlights } from "@/app/api/flights/search/route";
import { POST as extractQuote } from "@/app/api/quotations/extract/route";
import { db } from "./database";
import { hashPassword, verifyPassword } from "./password";
import { seedAccounts } from "./bootstrap";
import { GET as recoveryRequests, PATCH as handleRecovery } from "@/app/api/admin/recovery/route";
import { GET as databaseView, POST as databaseBackup } from "@/app/api/admin/database/route";
import { DatabaseSync } from "node:sqlite";
import { createEmptyQuotation } from "@/features/quotation/factory";

const origin = "http://localhost:3000";
const request = (path: string, method = "GET", body?: object, requestOrigin = origin) => new Request(origin + path, {
  method, headers: { origin: requestOrigin, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
});
const ctx = { params: Promise.resolve({ kind: "quotations" }) };
const password = "A private test password 492!";
const issuedPassword = "Temporary account password 135!";
let superSession = "";
let adminSession = "";
const envBefore = { path: process.env.PORTAL_DATABASE_PATH, key: process.env.PORTAL_SETUP_KEY };
beforeAll(async () => {
  process.env.PORTAL_DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "ark-access-")), "test.sqlite");
  delete process.env.PORTAL_SETUP_KEY;
  // Exercise seeded accounts without committing the deployment passwords in test files.
  const hash = await hashPassword(issuedPassword);
  db().prepare("UPDATE users SET password_hash=?").run(hash);
});
afterAll(() => {
  if (envBefore.path === undefined) delete process.env.PORTAL_DATABASE_PATH; else process.env.PORTAL_DATABASE_PATH = envBefore.path;
  if (envBefore.key === undefined) delete process.env.PORTAL_SETUP_KEY; else process.env.PORTAL_SETUP_KEY = envBefore.key;
});
const asAdmin = () => jar.set("ark_session", adminSession);
async function employee(role = "converter") {
  asAdmin();
  const email = `${randomUUID()}@example.com`;
  const response = await createUser(request("/api/admin/users", "POST", { name: "Employee", email, role, password: issuedPassword }));
  expect(response.status).toBe(201);
  const result = await response.json();
  expect(result).not.toHaveProperty("temporaryPassword");
  expect(JSON.stringify(result)).not.toContain(password);
  const id = String(db().prepare("SELECT id FROM users WHERE email=?").get(email)!.id);
  return { id, email, password: issuedPassword };
}
async function login(email: string, userPassword: string) {
  jar.clear(); return auth(request("/api/auth", "POST", { action: "login", email, password: userPassword }));
}
async function activate(user: Awaited<ReturnType<typeof employee>>) {
  expect((await login(user.email, user.password)).status).toBe(200);
  expect((await auth(request("/api/auth", "POST", { action: "change-password", currentPassword: user.password, password }))).status).toBe(200);
  return jar.get("ark_session")!;
}
async function asSuper() {
  if (!superSession) {
    expect((await login("admin@nexordis.com", issuedPassword)).status).toBe(200);
    expect((await auth(request("/api/auth", "POST", { action: "change-password", currentPassword: issuedPassword, password }))).status).toBe(200);
    superSession = jar.get("ark_session")!;
  }
  jar.set("ark_session", superSession);
}

describe("portal access boundaries", () => {
  it("requires authentication and rejects cross-origin writes", async () => {
    expect((await users(request("/api/admin/users"))).status).toBe(401);
    expect((await extractQuote(request("/api/quotations/extract", "POST", {}))).status).toBe(401);
    expect((await auth(request("/api/auth", "POST", { action: "login" }, "https://evil.example"))).status).toBe(403);
  });
  it("disables signup and seeds accounts with a one-time password change", async () => {
    const seeds = db().prepare("SELECT email,role,must_change_password FROM users ORDER BY email").all();
    expect(seeds).toEqual([
      expect.objectContaining({ email: "admin@nexordis.com", role: "super_admin", must_change_password: 1 }),
      expect.objectContaining({ email: "info@arktravelers.com", role: "admin", must_change_password: 1 }),
    ]);
    expect((await auth(request("/api/auth", "POST", { action: "setup", name: "Intruder", email: "intruder@example.com", password }))).status).toBe(403);
    expect(db().prepare("SELECT COUNT(*) AS n FROM users").get()!.n).toBe(2);
    const first = await login("info@arktravelers.com", issuedPassword);
    expect((await first.json()).next).toBe("/change-password");
    expect((await users(request("/api/admin/users"))).status).toBe(403);
    expect((await auth(request("/api/auth", "POST", { action: "change-password", currentPassword: "wrong", password }))).status).toBe(400);
    expect((await auth(request("/api/auth", "POST", { action: "change-password", currentPassword: issuedPassword, password: "short" }))).status).toBe(400);
    expect((await auth(request("/api/auth", "POST", { action: "change-password", currentPassword: issuedPassword, password }))).status).toBe(200);
    seedAccounts(db());
    expect((await login("info@arktravelers.com", issuedPassword)).status).toBe(401);
    const again = await login("info@arktravelers.com", password);
    expect((await again.json()).next).toBe("/");
    adminSession = jar.get("ark_session")!;
    const result = await (await users(request("/api/admin/users"))).json();
    expect(JSON.stringify(result)).not.toContain("password_hash");
  });
  it("requires one password change for new users and enforces converter restrictions server-side", async () => {
    const user = await employee();
    const signedIn = await login(user.email, user.password);
    expect(signedIn.status).toBe(200);
    expect((await signedIn.json()).next).toBe("/change-password");
    expect((await documents(request("/api/documents/quotations"), ctx)).status).toBe(403);
    await activate(user);
    expect((await users(request("/api/admin/users"))).status).toBe(403);
    expect((await searchFlights(request("/api/flights/search", "POST", {}))).status).toBe(403);
    const doc = createEmptyQuotation("manual");
    expect((await saveDocument(request("/api/documents/quotations", "PUT", doc), ctx)).status).toBe(200);
    expect((await deleteDocument(request("/api/documents/quotations", "DELETE", { id: doc.id }), ctx)).status).toBe(403);
  });
  it("rejects missing or weak passwords without creating users", async () => {
    asAdmin();
    for (const invalid of [undefined, "short", "x".repeat(257)]) {
      const email = `${randomUUID()}@example.com`;
      expect((await createUser(request("/api/admin/users", "POST", { name: "Employee", email, role: "converter", password: invalid }))).status).toBe(400);
      expect(db().prepare("SELECT id FROM users WHERE email=?").get(email)).toBeUndefined();
    }
  });
  it("keeps password-change enforcement for existing temporary-password accounts", async () => {
    const user = await employee();
    db().prepare("UPDATE users SET must_change_password=1 WHERE id=?").run(user.id);
    const signedIn = await login(user.email, user.password);
    expect((await signedIn.json()).next).toBe("/change-password");
    expect((await documents(request("/api/documents/quotations"), ctx)).status).toBe(403);
    expect((await auth(request("/api/auth", "POST", { action: "change-password", currentPassword: user.password, password: "Employee chosen new password 901!" }))).status).toBe(200);
    expect((await documents(request("/api/documents/quotations"), ctx)).status).toBe(200);
  });
  it("isolates employee records even with guessed IDs, while admin can inspect them", async () => {
    const owner = await employee(); await activate(owner);
    const doc = createEmptyQuotation("manual");
    await saveDocument(request("/api/documents/quotations", "PUT", doc), ctx);
    const manager = await employee("manager"); await activate(manager);
    const visible = await (await documents(request("/api/documents/quotations"), ctx)).json();
    expect(visible.records).toEqual([]);
    expect((await saveDocument(request("/api/documents/quotations", "PUT", doc), ctx)).status).toBe(404);
    expect((await deleteDocument(request("/api/documents/quotations", "DELETE", { id: doc.id }), ctx)).status).toBe(404);
    asAdmin();
    const all = await (await documents(request("/api/documents/quotations"), ctx)).json();
    expect(all.records.some((record: { id: string }) => record.id === doc.id)).toBe(true);
  });
  it("revokes existing sessions on disable and prevents disabled logins", async () => {
    const user = await employee("agent"); const session = await activate(user); asAdmin();
    expect((await updateUser(request("/api/admin/users", "PATCH", { ...user, name: "Employee", role: "agent", active: false, action: "update" }))).status).toBe(200);
    jar.set("ark_session", session);
    expect((await documents(request("/api/documents/quotations"), ctx)).status).toBe(401);
    expect((await login(user.email, password)).status).toBe(401);
  });
  it("revokes old credentials and sessions on password reset", async () => {
    const user = await employee(); const session = await activate(user); asAdmin();
    const newPassword = "Admin chosen replacement password 901!";
    for (const invalid of [undefined, "short", "x".repeat(257)]) {
      expect((await updateUser(request("/api/admin/users", "PATCH", { id: user.id, action: "reset-password", password: invalid }))).status).toBe(400);
    }
    const response = await updateUser(request("/api/admin/users", "PATCH", { id: user.id, action: "reset-password", password: newPassword }));
    const reset = await response.json(); expect(response.status).toBe(200);
    expect(reset).not.toHaveProperty("temporaryPassword");
    expect(JSON.stringify(reset)).not.toContain(newPassword);
    jar.set("ark_session", session);
    expect((await documents(request("/api/documents/quotations"), ctx)).status).toBe(401);
    expect((await login(user.email, password)).status).toBe(401);
    const signedIn = await login(user.email, newPassword);
    expect((await signedIn.json()).next).toBe("/change-password");
  });
  it("prevents self-demotion and duplicate emails", async () => {
    asAdmin(); const result = await (await users(request("/api/admin/users"))).json();
    const self = result.users.find((user: { email: string }) => user.email === "info@arktravelers.com");
    expect((await updateUser(request("/api/admin/users", "PATCH", { ...self, action: "update", role: "converter" }))).status).toBe(400);
    expect((await createUser(request("/api/admin/users", "POST", { name: "Duplicate", email: self.email, role: "converter", password }))).status).toBe(409);
  });
  it("throttles failed logins with a generic response", async () => {
    for (let i = 0; i < 8; i++) expect((await login("missing@example.com", "incorrect")).status).toBe(401);
    expect((await login("missing@example.com", "incorrect")).status).toBe(429);
  });
  it("revokes sessions immediately after a role change", async () => {
    const user = await employee("agent"); const session = await activate(user); asAdmin();
    expect((await updateUser(request("/api/admin/users", "PATCH", { ...user, name: "Employee", role: "converter", active: true, action: "update" }))).status).toBe(200);
    jar.set("ark_session", session);
    expect((await documents(request("/api/documents/quotations"), ctx)).status).toBe(401);
    await login(user.email, password);
    expect((await searchFlights(request("/api/flights/search", "POST", {}))).status).toBe(403);
  });
  it("allows managers to delete their own records and rejects forged flight-source documents", async () => {
    const user = await employee("manager"); await activate(user);
    const doc = createEmptyQuotation("manual");
    expect((await saveDocument(request("/api/documents/quotations", "PUT", doc), ctx)).status).toBe(200);
    expect((await deleteDocument(request("/api/documents/quotations", "DELETE", { id: doc.id }), ctx)).status).toBe(200);
    const converter = await employee(); await activate(converter);
    expect((await saveDocument(request("/api/documents/quotations", "PUT", createEmptyQuotation("flight_search")), ctx)).status).toBe(403);
    expect((await saveDocument(request("/api/documents/quotations", "PUT", { ...doc, id: "__proto__" }), ctx)).status).toBe(400);
  });
  it("rejects cross-origin document writes and revoked logout sessions", async () => {
    const user = await employee(); const session = await activate(user);
    expect((await saveDocument(request("/api/documents/quotations", "PUT", createEmptyQuotation("manual"), "https://evil.example"), ctx)).status).toBe(403);
    expect((await auth(request("/api/auth", "POST", { action: "logout" }))).status).toBe(200);
    jar.set("ark_session", session);
    expect((await documents(request("/api/documents/quotations"), ctx)).status).toBe(401);
  });
  it("protects super administrators from normal administrators, including forged role changes", async () => {
    asAdmin();
    const superUser = db().prepare("SELECT * FROM users WHERE email='admin@nexordis.com'").get()!;
    expect((await createUser(request("/api/admin/users", "POST", { name: "Forged Super", email: "forged@example.com", role: "super_admin", password }))).status).toBe(403);
    const ordinary = await employee(); asAdmin();
    expect((await updateUser(request("/api/admin/users", "PATCH", { ...ordinary, name: "Forged Super", role: "super_admin", active: true, action: "update" }))).status).toBe(403);
    expect((await updateUser(request("/api/admin/users", "PATCH", { id: superUser.id, action: "reset-password", password }))).status).toBe(403);
    expect((await updateUser(request("/api/admin/users", "PATCH", { id: superUser.id, name: superUser.name, email: superUser.email, role: "admin", active: false, action: "update" }))).status).toBe(403);
    expect((await removeUser(request("/api/admin/users", "DELETE", { id: ordinary.id }))).status).toBe(403);
    expect((await recoveryRequests(request("/api/admin/recovery"))).status).toBe(403);
    expect((await databaseView(request("/api/admin/database"))).status).toBe(403);
    expect((await databaseBackup(request("/api/admin/database", "POST"))).status).toBe(403);
  });
  it("queues recovery for all roles without revealing whether an email exists", async () => {
    const user = await employee(); jar.clear();
    const responses: unknown[] = [];
    for (const email of [user.email, "info@arktravelers.com", "admin@nexordis.com", "unknown-account@example.com"]) {
      const response = await auth(request("/api/auth", "POST", { action: "forgot-password", email }));
      expect(response.status).toBe(200); responses.push(await response.json());
    }
    expect(responses.every(result => JSON.stringify(result) === JSON.stringify(responses[0]))).toBe(true);
    await auth(request("/api/auth", "POST", { action: "forgot-password", email: user.email }));
    expect(db().prepare("SELECT COUNT(*) AS n FROM password_reset_requests WHERE user_id=? AND status='pending'").get(user.id)!.n).toBe(1);
    expect((await recoveryRequests(request("/api/admin/recovery"))).status).toBe(401);
    await asSuper();
    const inbox = await (await recoveryRequests(request("/api/admin/recovery"))).json();
    expect(inbox.requests.map((entry: { email: string }) => entry.email)).toEqual(expect.arrayContaining([user.email, "info@arktravelers.com", "admin@nexordis.com"]));
    expect(JSON.stringify(inbox)).not.toContain("password_hash");
    const pending = inbox.requests.find((entry: { email: string }) => entry.email === user.email);
    expect((await handleRecovery(request("/api/admin/recovery", "PATCH", { id: pending.id, action: "dismiss" }))).status).toBe(200);
    expect((await handleRecovery(request("/api/admin/recovery", "PATCH", { id: pending.id, action: "dismiss" }))).status).toBe(404);
  });
  it("allows the super administrator to reset the client administrator and resolves recovery requests", async () => {
    await asSuper();
    const admin = db().prepare("SELECT id FROM users WHERE email='info@arktravelers.com'").get()!;
    const temporary = "Admin recovery temporary password 973!";
    expect((await updateUser(request("/api/admin/users", "PATCH", { id: admin.id, action: "reset-password", password: temporary }))).status).toBe(200);
    expect(db().prepare("SELECT COUNT(*) AS n FROM password_reset_requests WHERE user_id=? AND status='pending'").get(admin.id)!.n).toBe(0);
    asAdmin(); expect((await users(request("/api/admin/users"))).status).toBe(401);
    expect((await login("info@arktravelers.com", password)).status).toBe(401);
    const signedIn = await login("info@arktravelers.com", temporary);
    expect((await signedIn.json()).next).toBe("/change-password");
    expect((await auth(request("/api/auth", "POST", { action: "change-password", currentPassword: temporary, password }))).status).toBe(200);
    const again = await login("info@arktravelers.com", password);
    expect((await again.json()).next).toBe("/"); adminSession = jar.get("ark_session")!;
  });
  it("allows database access only to super administrators and produces a valid SQLite snapshot", async () => {
    await asSuper();
    const response = await databaseView(request("/api/admin/database?table=users"));
    const result = await response.json(); expect(response.status).toBe(200);
    expect(result.counts.users).toBeGreaterThan(1);
    expect(JSON.stringify(result)).not.toContain("password_hash");
    expect((await databaseView(request("/api/admin/database?table=users%3BDROP%20TABLE%20users"))).status).toBe(400);
    expect((await databaseView(request("/api/admin/database?offset=-1"))).status).toBe(400);
    expect((await databaseBackup(request("/api/admin/database", "POST", {}, "https://evil.example"))).status).toBe(403);
    const snapshot = await databaseBackup(request("/api/admin/database", "POST"));
    expect(snapshot.status).toBe(200);
    const path = join(mkdtempSync(join(tmpdir(), "ark-snapshot-")), "backup.sqlite");
    writeFileSync(path, new Uint8Array(await snapshot.arrayBuffer()));
    const restored = new DatabaseSync(path, { readOnly: true });
    try { expect(restored.prepare("PRAGMA integrity_check").get()!.integrity_check).toBe("ok"); }
    finally { restored.close(); }
  });
  it("allows super administrators to delete accounts and preserves audit integrity", async () => {
    const user = await employee(); await activate(user);
    const doc = createEmptyQuotation("manual");
    await saveDocument(request("/api/documents/quotations", "PUT", doc), ctx);
    await asSuper();
    expect((await removeUser(request("/api/admin/users", "DELETE", { id: user.id }))).status).toBe(200);
    expect(db().prepare("SELECT id FROM users WHERE id=?").get(user.id)).toBeUndefined();
    expect(db().prepare("SELECT id FROM documents WHERE id=?").get(doc.id)).toBeUndefined();
    expect(db().prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    const self = db().prepare("SELECT * FROM users WHERE email='admin@nexordis.com'").get()!;
    expect((await removeUser(request("/api/admin/users", "DELETE", { id: self.id }))).status).toBe(400);
    expect((await updateUser(request("/api/admin/users", "PATCH", { ...self, active: false, action: "update" }))).status).toBe(400);
  });
  it("throttles repeated recovery without locking sign-in", async () => {
    const user = await employee();
    async function recover() {
      const delivery = request("/api/auth", "POST", { action: "forgot-password", email: user.email });
      delivery.headers.set("x-forwarded-for", "203.0.113.71");
      return auth(delivery);
    }
    for (let i = 0; i < 3; i++) expect((await recover()).status).toBe(200);
    await asSuper();
    const pending = db().prepare("SELECT id FROM password_reset_requests WHERE user_id=? AND status='pending'").get(user.id)!;
    expect((await handleRecovery(request("/api/admin/recovery", "PATCH", { id: pending.id, action: "dismiss" }))).status).toBe(200);
    expect((await recover()).status).toBe(200);
    expect(db().prepare("SELECT COUNT(*) AS n FROM password_reset_requests WHERE user_id=? AND status='pending'").get(user.id)!.n).toBe(0);
    expect((await login(user.email, user.password)).status).toBe(200);
  });
  it("supports voluntary password changes and only prompts once for temporary credentials", async () => {
    const user = await employee();
    const originalSession = await activate(user);
    const repeat = await login(user.email, password);
    expect((await repeat.json()).next).toBe("/");
    const secondSession = jar.get("ark_session")!;
    const chosen = "New settings password 234 private!";
    expect((await auth(request("/api/auth", "POST", { action: "change-password", currentPassword: password, password: chosen }))).status).toBe(200);
    for (const session of [originalSession, secondSession]) {
      jar.set("ark_session", session);
      expect((await documents(request("/api/documents/quotations"), ctx)).status).toBe(401);
    }
    expect((await login(user.email, password)).status).toBe(401);
    const later = await login(user.email, chosen);
    expect((await later.json()).next).toBe("/");
  });
  it("stores only password hashes and never writes credentials to the audit log", async () => {
    const user = await employee();
    const row = db().prepare("SELECT password_hash FROM users WHERE id=?").get(user.id)!;
    expect(String(row.password_hash)).toMatch(/^scrypt:/);
    expect(await verifyPassword(issuedPassword, String(row.password_hash))).toBe(true);
    const auditText = JSON.stringify(db().prepare("SELECT * FROM audit").all());
    expect(auditText).not.toContain(issuedPassword); expect(auditText).not.toContain(password);
  });

});
