import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./database";
import { clientKey } from "@/lib/rate-limit";

const acknowledgement = () => Response.json({ ok: true, message: "If this email has an account, a recovery request has been sent to the development team. Contact them privately to verify your identity and receive a temporary password." }, { headers: { "Cache-Control": "no-store" } });

export function requestRecovery(request: Request, body: unknown) {
  const parsed = z.object({ email: z.email().max(254).transform(value => value.toLowerCase()) }).safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  const database = db(); const now = Date.now();
  database.prepare("DELETE FROM login_attempts WHERE reset_at<=?").run(now);
  // Use separate keys from login attempts: recovery must never lock someone out of sign-in.
  const limits = [[`recovery:ip:${clientKey(request)}`, 10], [`recovery:email:${parsed.data.email}`, 3]] as const;
  for (const [identity, limit] of limits) {
    const key = createHash("sha256").update(identity).digest("hex");
    const attempt = database.prepare("SELECT count FROM login_attempts WHERE key=?").get(key);
    if (attempt && Number(attempt.count) >= limit) return acknowledgement();
    database.prepare("INSERT INTO login_attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1").run(key, now + 15 * 60_000);
  }
  const user = database.prepare("SELECT id FROM users WHERE email=?").get(parsed.data.email);
  if (user) database.prepare("INSERT INTO password_reset_requests (id,user_id,created_at) VALUES (?,?,?) ON CONFLICT DO NOTHING")
    .run(randomUUID(), user.id, new Date().toISOString());
  return acknowledgement();
}
