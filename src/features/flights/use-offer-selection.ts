"use client";

import { useCallback, useState } from "react";
import type { FlightOffer, OfferResponse } from "./schema";

type Refreshed = Extract<OfferResponse, { ok: true }>;

/** The re-priced offer, keeping the search id (Duffel's single-offer endpoint doesn't return it). */
const withSearchId = (latest: Refreshed, original: FlightOffer): Refreshed => ({
  ...latest,
  offer: { ...latest.offer, offerRequestId: latest.offer.offerRequestId || original.offerRequestId },
});

export type SelectionState =
  | { status: "idle" }
  | { status: "checking"; offer: FlightOffer }
  /** The provider's latest price differs from the search result: staff must accept it. */
  | { status: "price_changed"; previous: FlightOffer; latest: Refreshed }
  | { status: "error"; offer: FlightOffer; error: string; expired: boolean };

/**
 * Re-prices a selected offer with the provider before it is quoted. Calls
 * `onConfirmed` straight away when the price is unchanged; otherwise waits for
 * staff to accept the new price.
 */
export function useOfferSelection(onConfirmed: (latest: Refreshed) => void) {
  const [state, setState] = useState<SelectionState>({ status: "idle" });

  const select = useCallback(
    async (offer: FlightOffer) => {
      setState({ status: "checking", offer });
      try {
        const res = await fetch(`/api/flights/offers/${encodeURIComponent(offer.id)}`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as OfferResponse | null;
        if (!json) return setState({ status: "error", offer, error: "The server sent an unexpected response. Please try again.", expired: false });
        if (!json.ok) return setState({ status: "error", offer, error: json.error, expired: json.code === "offer_expired" });

        const latest = withSearchId(json, offer);
        if (latest.offer.totalAmount !== offer.totalAmount || latest.offer.totalCurrency !== offer.totalCurrency) {
          setState({ status: "price_changed", previous: offer, latest });
        } else {
          setState({ status: "idle" });
          onConfirmed(latest);
        }
      } catch {
        setState({ status: "error", offer, error: "We couldn't reach the server. Check your internet connection and try again.", expired: false });
      }
    },
    [onConfirmed],
  );

  const acceptNewPrice = useCallback(() => {
    if (state.status !== "price_changed") return;
    const latest = state.latest;
    setState({ status: "idle" });
    onConfirmed(latest);
  }, [state, onConfirmed]);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, select, acceptNewPrice, reset };
}
