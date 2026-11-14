import { afterAll, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { db } from "./database";
import { verifyPassword } from "./password";

const previous = process.env.PORTAL_DATABASE_PATH;
afterAll(() => { if (previous === undefined) delete process.env.PORTAL_DATABASE_PATH; else process.env.PORTAL_DATABASE_PATH = previous; });

describe("VPS recovery without a signed-in super administrator", () => {
  it("prompts privately, revokes sessions and flags exactly one password change", async () => {
    process.env.PORTAL_DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "ark-cli-recovery-")), "portal.sqlite");
    const database = db();
    const user = database.prepare("SELECT id FROM users WHERE role='super_admin'").get()!;
    database.prepare("UPDATE users SET must_change_password=0 WHERE id=?").run(user.id);
    database.prepare("INSERT INTO sessions VALUES ('old-session',?,?)").run(user.id, Date.now() + 60_000);
    database.prepare("INSERT INTO password_reset_requests (id,user_id,created_at) VALUES ('pending',?,?)").run(user.id, new Date().toISOString());
    const password = "CLI recovery temporary secret 712!";
    const child = spawn(process.execPath, [resolve("scripts/recover-password.mjs"), "admin@nexordis.com"], { env: process.env, stdio: ["pipe", "pipe", "pipe"] });
    let output = ""; let errors = ""; let sentFirst = false; let sentSecond = false;
    child.stdout.on("data", chunk => {
      output += chunk.toString();
      if (!sentFirst && output.includes("New temporary password")) { sentFirst = true; child.stdin.write(`${password}\n`); }
      if (!sentSecond && output.includes("Confirm temporary password")) { sentSecond = true; child.stdin.end(`${password}\n`); }
    });
    child.stderr.on("data", chunk => { errors += chunk.toString(); });
    const code = await new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    expect(code, errors).toBe(0);
    expect(output).not.toContain(password);
    const changed = database.prepare("SELECT * FROM users WHERE id=?").get(user.id)!;
    expect(await verifyPassword(password, String(changed.password_hash))).toBe(true);
    expect(changed.must_change_password).toBe(1);
    expect(database.prepare("SELECT * FROM sessions WHERE user_id=?").all(user.id)).toEqual([]);
    expect(database.prepare("SELECT status FROM password_reset_requests WHERE id='pending'").get()!.status).toBe("resolved");
    expect(database.prepare("SELECT action FROM audit ORDER BY id DESC LIMIT 1").get()!.action).toBe("password.server_recovery");
  }, 10_000);
});
