// Test the actual production server against an isolated temporary database.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";

const base = "http://localhost:3107";
const setupKey = randomBytes(32).toString("hex");
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", "3107"], {
  detached: true, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, PORTAL_DATABASE_PATH: join(mkdtempSync(join(tmpdir(), "ark-smoke-")), "portal.sqlite"), PORTAL_SETUP_KEY: setupKey },
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
  const setup = await api("/api/auth", "POST", { action: "setup", setupKey, name: "Smoke Admin", email: "admin@example.com", password: "Smoke admin private password 123!" });
  assert.equal(setup.status, 200, JSON.stringify(setup.body));
  const adminCookie = cookie;
  const home = await fetch(base, { headers: { Cookie: cookie } });
  assert.equal(home.status, 200); assert.match(await home.text(), /Users &amp; access/);
  assert.equal((await fetch(base + "/admin/users", { headers: { Cookie: cookie } })).status, 200);
  const created = await api("/api/admin/users", "POST", { name: "PDF Employee", email: "employee@example.com", role: "converter" });
  assert.equal(created.status, 201);
  cookie = "";
  const login = await api("/api/auth", "POST", { action: "login", email: "employee@example.com", password: created.body.temporaryPassword });
  assert.equal(login.body.next, "/change-password");
  assert.equal((await api("/api/documents/quotations")).status, 403);
  assert.equal((await api("/api/auth", "POST", { action: "change-password", currentPassword: created.body.temporaryPassword, password: "Employee new private password 456!" })).status, 200);
  assert.equal((await api("/api/flights/search", "POST", {})).status, 403);
  assert.equal((await api("/api/admin/users")).status, 403);
  assert.equal((await api("/api/documents/quotations")).status, 200);
  const employeeHome = await fetch(base, { headers: { Cookie: cookie } });
  const html = await employeeHome.text(); assert.equal(employeeHome.status, 200); assert(!html.includes('href="/flights/search"')); assert(!html.includes('href="/admin/users"'));
  cookie = adminCookie;
  const user = (await api("/api/admin/users")).body.users.find(value => value.email === "employee@example.com");
  const employeeCookie = (await (async () => { cookie = ""; await api("/api/auth", "POST", { action: "login", email: user.email, password: "Employee new private password 456!" }); return cookie; })());
  cookie = adminCookie;
  assert.equal((await api("/api/admin/users", "PATCH", { ...user, action: "update", active: false })).status, 200);
  cookie = employeeCookie;
  assert.equal((await api("/api/documents/quotations")).status, 401);
  console.log("Production smoke test passed: setup, admin page, login, forced password change, restricted navigation/APIs, and revoked sessions.");
} catch (error) { console.error(output); throw error; }
finally { try { process.kill(-server.pid, "SIGTERM"); } catch { /* Already stopped. */ } }
