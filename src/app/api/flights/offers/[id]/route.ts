import { apiAccess } from "@/features/auth/server";
import { connection } from "next/server";
import { FlightProviderError, getFlightProvider } from "@/features/flights/server/providers";
import type { OfferResponse } from "@/features/flights/schema";
import { createRateLimiter } from "@/lib/rate-limit";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

/** Latest price and details for one offer — always called before quoting it. */
export async function GET(request: Request, ctx: RouteContext<"/api/flights/offers/[id]">) {
  await connection();
  const access = await apiAccess(request, "flights"); if (access.response) return access.response;
  try {
    if (!limiter(access.user.id).ok) throw new FlightProviderError("rate_limited", "Too many requests. Please wait a moment.", 429);
    const { id } = await ctx.params;
    const provider = getFlightProvider();
    const offer = await provider.refreshOffer(id);
    return Response.json({ ok: true, provider: provider.info, offer, refreshedAt: new Date().toISOString() } satisfies OfferResponse);
  } catch (error) {
    const safe =
      error instanceof FlightProviderError
        ? error
        : new FlightProviderError("provider_unavailable", "Couldn't check the latest price. Please try again.", 500);
    if (!(error instanceof FlightProviderError)) console.error("[flights/offers] unexpected error:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false, error: safe.message, code: safe.code } satisfies OfferResponse, { status: safe.status });
  }
}
