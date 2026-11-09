import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const file = ".env.local";
const contents = existsSync(file) ? readFileSync(file, "utf8") : "";
const existing = contents.match(/^PORTAL_SETUP_KEY=(.*)$/m)?.[1]?.trim();
if (existing && existing.length >= 24) {
  console.log("A setup key is already configured in .env.local. Use it on /login.");
} else {
  const key = randomBytes(32).toString("hex");
  const next = contents.replace(/^PORTAL_SETUP_KEY=.*\r?\n?/gm, "");
  writeFileSync(file, `${next.trimEnd()}\n\nPORTAL_SETUP_KEY=${key}\n`, { mode: 0o600 });
  console.log("Setup key saved to .env.local. Restart the app, then use this key at /login:");
  console.log(key);
  console.log("Create your administrator account, then remove PORTAL_SETUP_KEY from .env.local.");
}
