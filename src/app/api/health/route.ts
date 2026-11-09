import { connection } from "next/server";
import { currentUser } from "@/features/auth/server";
import { can } from "@/features/auth/permissions";

/** Liveness + configuration status. Never returns secrets, only whether they are set. */
export async function GET() {
  await connection();
  const user = await currentUser();
  if (!user || !can(user.role, "users")) return Response.json({ status: "ok" });
  const duffelEnv = (process.env.DUFFEL_ENV ?? "test").toLowerCase();
  return Response.json({
    status: "ok",
    extractionProvider: (process.env.EXTRACTION_PROVIDER ?? "openai").toLowerCase(),
    aiConfigured: Boolean(process.env.OPENAI_API_KEY) || process.env.EXTRACTION_PROVIDER === "mock",
    flightProvider: (process.env.FLIGHT_PROVIDER ?? "duffel").toLowerCase(),
    flightMode: duffelEnv,
    flightSearchConfigured: Boolean(duffelEnv === "live" ? process.env.DUFFEL_LIVE_ACCESS_TOKEN : process.env.DUFFEL_TEST_ACCESS_TOKEN),
  });
}
