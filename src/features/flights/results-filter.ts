import { offerAirlines, sliceStops, splitLocal } from "./format";
import type { FlightOffer } from "./schema";

/** Sorting and filtering of search results. Pure, so every rule is unit-tested. */

export type SortKey = "price" | "duration" | "departure";
export type StopsFilter = "any" | "0" | "1" | "2";
export type TimeOfDay = "night" | "morning" | "afternoon" | "evening";

export const TIMES_OF_DAY: readonly { value: TimeOfDay; label: string; hours: string; from: number; to: number }[] = [
  { value: "night", label: "Night", hours: "00–06", from: 0, to: 6 },
  { value: "morning", label: "Morning", hours: "06–12", from: 6, to: 12 },
  { value: "afternoon", label: "Afternoon", hours: "12–18", from: 12, to: 18 },
  { value: "evening", label: "Evening", hours: "18–24", from: 18, to: 24 },
];

export interface OfferFilters {
  stops: StopsFilter;
  /** Airlines flown; empty means all. An offer matches if it flies any of them. */
  airlines: readonly string[];
  /** Departure of the first flight; empty means any time. */
  departure: readonly TimeOfDay[];
  /** Highest total price, or null for no limit. */
  maxPrice: number | null;
}

export const NO_FILTERS: OfferFilters = { stops: "any", airlines: [], departure: [], maxPrice: null };

export const isFiltered = (f: OfferFilters) => f.stops !== "any" || f.airlines.length > 0 || f.departure.length > 0 || f.maxPrice !== null;

/** The most stops on any part of the trip: "Direct" means every flight is direct. */
export const offerStops = (o: FlightOffer) => Math.max(...o.slices.map((s) => sliceStops(s.segments)));

/** Whole-trip flying and connection time; null when the airline didn't say. */
export function offerMinutes(o: FlightOffer): number | null {
  let total = 0;
  for (const slice of o.slices) {
    if (slice.durationMinutes === null) return null;
    total += slice.durationMinutes;
  }
  return total;
}

export function offerTimeOfDay(o: FlightOffer): TimeOfDay | null {
  const hour = Number(splitLocal(o.slices[0].segments[0].departingAt).time?.slice(0, 2));
  return TIMES_OF_DAY.find((t) => hour >= t.from && hour < t.to)?.value ?? null;
}

const matchesStops = (o: FlightOffer, f: OfferFilters) => f.stops === "any" || offerStops(o) <= Number(f.stops);
const matchesAirlines = (o: FlightOffer, f: OfferFilters) => f.airlines.length === 0 || offerAirlines(o).some((a) => f.airlines.includes(a));
const matchesDeparture = (o: FlightOffer, f: OfferFilters) => {
  if (f.departure.length === 0) return true;
  const time = offerTimeOfDay(o);
  return time !== null && f.departure.includes(time);
};
const matchesPrice = (o: FlightOffer, f: OfferFilters) => f.maxPrice === null || o.totalAmount <= f.maxPrice;

const RULES = { stops: matchesStops, airlines: matchesAirlines, departure: matchesDeparture, maxPrice: matchesPrice };
type FilterKey = keyof typeof RULES;

const matches = (o: FlightOffer, f: OfferFilters, ignore?: FilterKey) =>
  (Object.keys(RULES) as FilterKey[]).every((key) => key === ignore || RULES[key](o, f));

export const filterOffers = (offers: readonly FlightOffer[], filters: OfferFilters) => offers.filter((o) => matches(o, filters));

/** Offers with unknown durations go last, not first, when sorting by fastest. */
const minutesOrLast = (o: FlightOffer) => offerMinutes(o) ?? Number.POSITIVE_INFINITY;
const compareBy = (a: number, b: number) => (a === b ? 0 : a - b);

const COMPARATORS: Record<SortKey, (a: FlightOffer, b: FlightOffer) => number> = {
  price: (a, b) => a.totalAmount - b.totalAmount || compareBy(minutesOrLast(a), minutesOrLast(b)),
  duration: (a, b) => compareBy(minutesOrLast(a), minutesOrLast(b)) || a.totalAmount - b.totalAmount,
  departure: (a, b) => a.slices[0].segments[0].departingAt.localeCompare(b.slices[0].segments[0].departingAt) || a.totalAmount - b.totalAmount,
};

export const sortOffers = (offers: readonly FlightOffer[], sort: SortKey) => [...offers].sort(COMPARATORS[sort]);

export interface FilterOptions {
  /** How many results each option would give, given the other active filters. */
  stops: Record<StopsFilter, number>;
  airlines: { name: string; count: number }[];
  departure: Record<TimeOfDay, number>;
  minPrice: number;
  maxPrice: number;
}

/** What each filter can offer. Counts ignore the filter's own choice, so options stay comparable. */
export function filterOptions(offers: readonly FlightOffer[], filters: OfferFilters): FilterOptions {
  const countWhere = (ignore: FilterKey, test: (o: FlightOffer) => boolean) => offers.filter((o) => matches(o, filters, ignore) && test(o)).length;
  const prices = offers.map((o) => o.totalAmount);

  return {
    stops: {
      any: countWhere("stops", () => true),
      "0": countWhere("stops", (o) => offerStops(o) <= 0),
      "1": countWhere("stops", (o) => offerStops(o) <= 1),
      "2": countWhere("stops", (o) => offerStops(o) <= 2),
    },
    airlines: [...new Set(offers.flatMap(offerAirlines))]
      .map((name) => ({ name, count: countWhere("airlines", (o) => offerAirlines(o).includes(name)) }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    departure: {
      night: countWhere("departure", (o) => offerTimeOfDay(o) === "night"),
      morning: countWhere("departure", (o) => offerTimeOfDay(o) === "morning"),
      afternoon: countWhere("departure", (o) => offerTimeOfDay(o) === "afternoon"),
      evening: countWhere("departure", (o) => offerTimeOfDay(o) === "evening"),
    },
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
  };
}
