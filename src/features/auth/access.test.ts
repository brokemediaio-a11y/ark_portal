import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => jar.has(name) ? { value: jar.get(name) } : undefined,
  set: (name: string, value: string) => jar.set(name, value), delete: (name: string) => jar.delete(name),
}) }));

import { POST as auth } from "@/app/api/auth/route";
import { GET as users, POST as createUser, PATCH as updateUser } from "@/app/api/admin/users/route";
import { GET as documents, PUT as saveDocument, DELETE as deleteDocument } from "@/app/api/documents/[kind]/route";
import { POST as searchFlights } from "@/app/api/flights/search/route";
import { POST as extractQuote } from "@/app/api/quotations/extract/route";
import { db } from "./database";
import { createEmptyQuotation } from "@/features/quotation/factory";

const origin = "http://localhost:3000";
const request = (path: string, method = "GET", body?: object, requestOrigin = origin) => new Request(origin + path, {
  method, headers: { origin: requestOrigin, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
});
const ctx = { params: Promise.resolve({ kind: "quotations" }) };
const password = "A private test password 492!";
let adminSession = "";
const envBefore = { path: process.env.PORTAL_DATABASE_PATH, key: process.env.PORTAL_SETUP_KEY };
beforeAll(() => {
  process.env.PORTAL_DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "ark-access-")), "test.sqlite");
  process.env.PORTAL_SETUP_KEY = "test-setup-key-only-for-test-suite-123456";
});
afterAll(() => {
  if (envBefore.path === undefined) delete process.env.PORTAL_DATABASE_PATH; else process.env.PORTAL_DATABASE_PATH = envBefore.path;
  if (envBefore.key === undefined) delete process.env.PORTAL_SETUP_KEY; else process.env.PORTAL_SETUP_KEY = envBefore.key;
});
const asAdmin = () => jar.set("ark_session", adminSession);
async function employee(role = "converter") {
  asAdmin();
  const email = `${randomUUID()}@example.com`;
  const response = await createUser(request("/api/admin/users", "POST", { name: "Employee", email, role }));
  expect(response.status).toBe(201);
  const result = await response.json();
  const id = String(db().prepare("SELECT id FROM users WHERE email=?").get(email)!.id);
  return { id, email, temporaryPassword: result.temporaryPassword as string };
}
async function login(email: string, userPassword: string) {
  jar.clear(); return auth(request("/api/auth", "POST", { action: "login", email, password: userPassword }));
}
async function activate(user: Awaited<ReturnType<typeof employee>>) {
  expect((await login(user.email, user.temporaryPassword)).status).toBe(200);
  const changed = await auth(request("/api/auth", "POST", { action: "change-password", currentPassword: user.temporaryPassword, password }));
  expect(changed.status).toBe(200);
  return jar.get("ark_session")!;
}

describe("portal access boundaries", () => {
  it("requires authentication and rejects cross-origin writes", async () => {
    expect((await users(request("/api/admin/users"))).status).toBe(401);
    expect((await extractQuote(request("/api/quotations/extract", "POST", {}))).status).toBe(401);
    expect((await auth(request("/api/auth", "POST", { action: "login" }, "https://evil.example"))).status).toBe(403);
  });
  it("bootstraps only once with a server setup key and never returns password hashes", async () => {
    const body = { action: "setup", name: "Client Admin", email: "client@example.com", password, setupKey: process.env.PORTAL_SETUP_KEY };
    expect((await auth(request("/api/auth", "POST", { ...body, setupKey: "wrong" }))).status).toBe(403);
    expect((await auth(request("/api/auth", "POST", body))).status).toBe(200);
    adminSession = jar.get("ark_session")!;
    expect((await auth(request("/api/auth", "POST", body))).status).toBe(403);
    const result = await (await users(request("/api/admin/users"))).json();
    expect(result.users[0].role).toBe("admin"); expect(JSON.stringify(result)).not.toContain("password_hash");
  });
  it("forces temporary-password replacement and enforces converter restrictions server-side", async () => {
    const user = await employee();
    expect((await login(user.email, user.temporaryPassword)).status).toBe(200);
    expect((await documents(request("/api/documents/quotations"), ctx)).status).toBe(403);
    await activate(user);
    expect((await users(request("/api/admin/users"))).status).toBe(403);
    expect((await searchFlights(request("/api/flights/search", "POST", {}))).status).toBe(403);
    const doc = createEmptyQuotation("manual");
    expect((await saveDocument(request("/api/documents/quotations", "PUT", doc), ctx)).status).toBe(200);
    expect((await deleteDocument(request("/api/documents/quotations", "DELETE", { id: doc.id }), ctx)).status).toBe(403);
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
    const response = await updateUser(request("/api/admin/users", "PATCH", { id: user.id, action: "reset-password" }));
    const reset = await response.json(); expect(response.status).toBe(200);
    jar.set("ark_session", session);
    expect((await documents(request("/api/documents/quotations"), ctx)).status).toBe(401);
    expect((await login(user.email, password)).status).toBe(401);
    const signedIn = await login(user.email, reset.temporaryPassword);
    expect((await signedIn.json()).next).toBe("/change-password");
  });
  it("prevents self-demotion and duplicate emails", async () => {
    asAdmin(); const result = await (await users(request("/api/admin/users"))).json();
    const self = result.users.find((user: { email: string }) => user.email === "client@example.com");
    expect((await updateUser(request("/api/admin/users", "PATCH", { ...self, action: "update", role: "converter" }))).status).toBe(400);
    expect((await createUser(request("/api/admin/users", "POST", { name: "Duplicate", email: self.email, role: "converter" }))).status).toBe(409);
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
});
