import { apiAccess } from "@/features/auth/server";
import { limitOffers } from "@/features/flights/server/offer-limit";
import { FlightProviderError, getFlightProvider } from "@/features/flights/server/providers";
import { parseSearchRequest } from "@/features/flights/server/search-service";
import type { FlightSearchResponse } from "@/features/flights/schema";
import { localToday } from "@/lib/dates";
import { createRateLimiter } from "@/lib/rate-limit";

export const maxDuration = 60;

// Searches may be billable once live, so cap them per user.
const limiter = createRateLimiter({ limit: 15, windowMs: 60_000 });

const fail = (e: FlightProviderError) =>
  Response.json({ ok: false, error: e.message, code: e.code, field: e.field } satisfies FlightSearchResponse, { status: e.status });

export async function POST(request: Request) {
  const access = await apiAccess(request, "flights"); if (access.response) return access.response;
  try {
    const rate = limiter(access.user.id);
    if (!rate.ok)
      throw new FlightProviderError("rate_limited", `Too many searches. Please wait ${rate.retryAfterSeconds} seconds and try again.`, 429);

    const searchRequest = parseSearchRequest(await request.json().catch(() => null), localToday());
    const provider = getFlightProvider();
    const { offerRequestId, offers } = await provider.search(searchRequest, request.signal);

    return Response.json({
      ok: true,
      provider: provider.info,
      offerRequestId,
      offers: limitOffers(offers),
      totalFound: offers.length,
      searchedAt: new Date().toISOString(),
    } satisfies FlightSearchResponse);
  } catch (error) {
    if (error instanceof FlightProviderError) return fail(error);
    console.error("[flights/search] unexpected error:", error instanceof Error ? error.message : "unknown");
    return fail(new FlightProviderError("provider_unavailable", "Something went wrong while searching. Please try again.", 500));
  }
}
