import { connection, type NextRequest } from "next/server";
import { FlightProviderError, getFlightProvider } from "@/features/flights/server/providers";
import type { LocationsResponse } from "@/features/flights/schema";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";

const limiter = createRateLimiter({ limit: 240, windowMs: 60_000 });

export async function GET(request: NextRequest) {
  // Request-time only; must run before the try so Next's prerender bail-out isn't swallowed.
  await connection();
  try {
    if (!limiter(clientKey(request)).ok)
      throw new FlightProviderError("rate_limited", "Too many requests. Please slow down.", 429);
    const query = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 60);
    const places = await getFlightProvider().searchPlaces(query);
    return Response.json({ ok: true, places } satisfies LocationsResponse);
  } catch (error) {
    const safe =
      error instanceof FlightProviderError
        ? error
        : new FlightProviderError("provider_unavailable", "Airport search is unavailable right now.", 500);
    if (!(error instanceof FlightProviderError)) console.error("[flights/locations] unexpected error:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false, error: safe.message, code: safe.code } satisfies LocationsResponse, { status: safe.status });
  }
}
