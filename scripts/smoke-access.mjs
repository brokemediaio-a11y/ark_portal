// Test the actual production server against an isolated temporary database.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const base = "http://localhost:3107";
const databasePath = join(mkdtempSync(join(tmpdir(), "ark-smoke-")), "portal.sqlite");
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", "3107"], {
  detached: true, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, PORTAL_DATABASE_PATH: databasePath },
});
let output = ""; server.stdout.on("data", data => { output += data; }); server.stderr.on("data", data => { output += data; });
let cookie = "";
async function api(path, method = "GET", body) {
  const response = await fetch(base + path, { method, headers: { Origin: base, Cookie: cookie, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const session = response.headers.getSetCookie().find(value => value.startsWith("ark_session="));
  if (session) cookie = session.split(";")[0];
  return { status: response.status, body: await response.json() };
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(base + "/api/health")).ok) { ready = true; break; } } catch { /* Server is starting. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert(ready, "Production server starts");
  assert.equal((await api("/api/admin/users")).status, 401);
  assert.equal((await api("/api/auth", "POST", { action: "setup", name: "Intruder", email: "intruder@example.com", password: "Unauthorized signup password 123!" })).status, 403);
  // Keep deployment bootstrap credentials out of test source. Only this isolated database is changed.
  const testDb = new DatabaseSync(databasePath); const salt = randomBytes(16).toString("hex");
  const temporary = "Smoke initial temporary password 123!";
  testDb.prepare("UPDATE users SET password_hash=? WHERE email='info@arktravelers.com'").run(`scrypt:${salt}:${scryptSync(temporary, salt, 64).toString("hex")}`); testDb.close();
  const first = await api("/api/auth", "POST", { action: "login", email: "info@arktravelers.com", password: temporary });
  assert.equal(first.body.next, "/change-password");
  assert.equal((await api("/api/admin/users")).status, 403);
  assert.equal((await api("/api/auth", "POST", { action: "change-password", currentPassword: temporary, password: "Smoke admin private password 123!" })).status, 200);
  const adminCookie = cookie;
  const home = await fetch(base, { headers: { Cookie: cookie } });
  assert.equal(home.status, 200); assert.match(await home.text(), /Users &amp; access/);
  assert.equal((await fetch(base + "/admin/users", { headers: { Cookie: cookie } })).status, 200);
  const created = await api("/api/admin/users", "POST", { name: "PDF Employee", email: "employee@example.com", role: "converter", password: "Employee private password 456!" });
  assert.equal(created.status, 201);
  cookie = "";
  const login = await api("/api/auth", "POST", { action: "login", email: "employee@example.com", password: "Employee private password 456!" });
  assert.equal(login.body.next, "/change-password");
  assert.equal((await api("/api/documents/quotations")).status, 403);
  assert.equal((await api("/api/auth", "POST", { action: "change-password", currentPassword: "Employee private password 456!", password: "Employee new private password 456!" })).status, 200);
  assert.equal((await api("/api/flights/search", "POST", {})).status, 403);
  assert.equal((await api("/api/admin/users")).status, 403);
  assert.equal((await api("/api/documents/quotations")).status, 200);
  const repeatLogin = await api("/api/auth", "POST", { action: "login", email: "employee@example.com", password: "Employee new private password 456!" });
  assert.equal(repeatLogin.body.next, "/");
  assert.equal((await fetch(base + "/settings", { headers: { Cookie: cookie } })).status, 200);
  const employeeHome = await fetch(base, { headers: { Cookie: cookie } });
  const html = await employeeHome.text(); assert.equal(employeeHome.status, 200); assert(!html.includes('href="/flights/search"')); assert(!html.includes('href="/admin/users"'));
  cookie = adminCookie;
  const user = (await api("/api/admin/users")).body.users.find(value => value.email === "employee@example.com");
  const employeeCookie = (await (async () => { cookie = ""; await api("/api/auth", "POST", { action: "login", email: user.email, password: "Employee new private password 456!" }); return cookie; })());
  cookie = adminCookie;
  assert.equal((await api("/api/admin/users", "PATCH", { ...user, action: "update", active: false })).status, 200);
  cookie = employeeCookie;
  assert.equal((await api("/api/documents/quotations")).status, 401);
  console.log("Production smoke test passed: disabled signup, seeded admin, first-login-only password change, settings, restricted navigation/APIs, and revoked sessions.");
} catch (error) { console.error(output); throw error; }
finally { try { process.kill(-server.pid, "SIGTERM"); } catch { /* Already stopped. */ } }
