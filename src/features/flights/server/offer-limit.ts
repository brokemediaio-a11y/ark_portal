import { offerAirlines } from "../format";
import { offerStops } from "../results-filter";
import type { FlightOffer } from "../schema";

/**
 * Busy routes return thousands of fares (2,500 fares was 9.5 MB when tested), which
 * is slow to load and over many hosts' response limit. 500 keeps a response under
 * 2 MB, far more than anyone reads.
 */
export const MAX_OFFERS = 500;
/** Cheapest fares always kept for each airline, and for each number of stops. */
const PER_AIRLINE = 15;
const PER_STOPS = 75;

/**
 * The fares worth showing when there are too many: the cheapest of every airline
 * and every number of stops, so that no filter option disappears, then the
 * cheapest overall. An expensive direct flight survives a flood of cheap connections.
 */
export function limitOffers(offers: readonly FlightOffer[], limit = MAX_OFFERS): FlightOffer[] {
  if (offers.length <= limit) return [...offers];
  const byPrice = [...offers].sort((a, b) => a.totalAmount - b.totalAmount);
  const kept = new Set<FlightOffer>();
  const takeCheapest = (groupOf: (o: FlightOffer) => (string | number)[], perGroup: number) => {
    const counts = new Map<string | number, number>();
    for (const offer of byPrice) {
      for (const group of groupOf(offer)) {
        const count = counts.get(group) ?? 0;
        if (count < perGroup && kept.size < limit) {
          kept.add(offer);
          counts.set(group, count + 1);
        }
      }
    }
  };
  takeCheapest((o) => [offerStops(o)], PER_STOPS);
  takeCheapest(offerAirlines, PER_AIRLINE);
  for (const offer of byPrice) {
    if (kept.size >= limit) break;
    kept.add(offer);
  }
  return byPrice.filter((offer) => kept.has(offer));
}
