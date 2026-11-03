import "server-only";
import { createTtlCache } from "@/lib/ttl-cache";
import type { Place } from "../../../schema";
import { FlightProviderError, type FlightProvider } from "../types";
import { duffelRequest } from "./client";
import { getDuffelConfig } from "./config";
import { toOffer, toOfferRequestBody, toPlace } from "./normalize";
import { lenientList, rawOfferRequestSchema, rawOfferSchema, rawPlaceSchema } from "./raw-schemas";

/** How long Duffel waits for airlines before returning what it has (ms). */
const SUPPLIER_TIMEOUT_MS = 20_000;
const placesCache = createTtlCache<Place[]>({ ttlMs: 24 * 60 * 60 * 1000, maxEntries: 2_000, name: "duffel-places" });

/** Guard: in test configuration, refuse anything Duffel marks as live. */
function assertMode(liveMode: boolean) {
  if (liveMode !== getDuffelConfig().liveMode) {
    console.error("[duffel] response mode does not match configuration — discarding");
    throw new FlightProviderError("not_configured", "Flight search is misconfigured. Please contact your administrator.", 503);
  }
}

export const duffelProvider: FlightProvider = {
  get info() {
    const liveMode = getDuffelConfig().liveMode;
    return { id: "duffel", label: liveMode ? "Duffel" : "Duffel (test mode)", liveMode };
  },

  async search(request, signal) {
    const data = await duffelRequest(
      "POST",
      `/air/offer_requests?return_offers=true&supplier_timeout=${SUPPLIER_TIMEOUT_MS}`,
      rawOfferRequestSchema,
      { body: toOfferRequestBody(request), timeoutMs: SUPPLIER_TIMEOUT_MS + 25_000, signal },
    );
    assertMode(data.live_mode);
    return { offerRequestId: data.id, offers: data.offers.map((o) => toOffer(o, data.id, "duffel")) };
  },

  async refreshOffer(offerId) {
    if (!/^off_[A-Za-z0-9]+$/.test(offerId)) throw new FlightProviderError("invalid_request", "Unknown fare.", 400);
    const raw = await duffelRequest("GET", `/air/offers/${offerId}`, rawOfferSchema);
    assertMode(raw.live_mode);
    // This endpoint doesn't return the search id; the client keeps it from the search result.
    return toOffer(raw, "", "duffel");
  },

  async searchPlaces(query) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return placesCache(q, async () => {
      const places = await duffelRequest("GET", `/places/suggestions?query=${encodeURIComponent(q)}`, lenientList(rawPlaceSchema), { timeoutMs: 10_000 });
      return places.filter((p) => p.iata_code).map(toPlace).slice(0, 10);
    });
  },
};
