import { describe, expect, it } from "vitest";
import { NO_FILTERS, filterOffers, filterOptions, isFiltered, offerMinutes, sortOffers } from "./results-filter";
import type { FlightOffer } from "./schema";

interface Spec {
  id: string;
  price: number;
  /** Airline per flight of the first slice; one entry = direct. */
  airlines: string[];
  departs?: string;
  minutes?: number | null;
}

const offer = ({ id, price, airlines, departs = "08:00", minutes = 300 }: Spec) =>
  ({
    id,
    totalAmount: price,
    totalCurrency: "EUR",
    owner: { iata: null, name: airlines[0] },
    slices: [
      {
        durationMinutes: minutes,
        segments: airlines.map((name) => ({ marketing: { iata: null, name, flightNumber: "1" }, departingAt: `2026-12-05T${departs}`, technicalStops: 0 })),
      },
    ],
  }) as unknown as FlightOffer;

const OFFERS = [
  offer({ id: "direct-night", price: 500, airlines: ["BA"], departs: "02:00", minutes: 400 }),
  offer({ id: "one-stop-morning", price: 300, airlines: ["TK", "TK"], departs: "09:00", minutes: 700 }),
  offer({ id: "two-stops-evening", price: 200, airlines: ["QR", "QR", "EK"], departs: "21:00", minutes: 900 }),
  offer({ id: "direct-afternoon", price: 800, airlines: ["TK"], departs: "15:00", minutes: 380 }),
];
const ids = (offers: FlightOffer[]) => offers.map((o) => o.id);

describe("filterOffers", () => {
  it("returns everything with no filters", () => {
    expect(filterOffers(OFFERS, NO_FILTERS)).toHaveLength(4);
    expect(isFiltered(NO_FILTERS)).toBe(false);
  });

  it("filters by stops", () => {
    expect(ids(filterOffers(OFFERS, { ...NO_FILTERS, stops: "0" }))).toEqual(["direct-night", "direct-afternoon"]);
    expect(ids(filterOffers(OFFERS, { ...NO_FILTERS, stops: "1" }))).toEqual(["direct-night", "one-stop-morning", "direct-afternoon"]);
    expect(filterOffers(OFFERS, { ...NO_FILTERS, stops: "2" })).toHaveLength(4);
  });

  it("filters by any of several airlines, including one flown on only part of the trip", () => {
    expect(ids(filterOffers(OFFERS, { ...NO_FILTERS, airlines: ["BA", "EK"] }))).toEqual(["direct-night", "two-stops-evening"]);
  });

  it("filters by departure time of day", () => {
    expect(ids(filterOffers(OFFERS, { ...NO_FILTERS, departure: ["morning", "evening"] }))).toEqual(["one-stop-morning", "two-stops-evening"]);
  });

  it("filters by maximum price, inclusively", () => {
    expect(ids(filterOffers(OFFERS, { ...NO_FILTERS, maxPrice: 300 }))).toEqual(["one-stop-morning", "two-stops-evening"]);
  });

  it("combines filters", () => {
    expect(ids(filterOffers(OFFERS, { stops: "0", airlines: ["TK"], departure: ["afternoon"], maxPrice: 900 }))).toEqual(["direct-afternoon"]);
    expect(filterOffers(OFFERS, { ...NO_FILTERS, stops: "0", maxPrice: 300 })).toEqual([]);
  });
});

describe("sortOffers", () => {
  it("sorts by price, duration and departure without changing the input", () => {
    expect(ids(sortOffers(OFFERS, "price"))[0]).toBe("two-stops-evening");
    expect(ids(sortOffers(OFFERS, "duration"))[0]).toBe("direct-afternoon");
    expect(ids(sortOffers(OFFERS, "departure"))[0]).toBe("direct-night");
    expect(OFFERS[0].id).toBe("direct-night");
  });

  it("puts unknown durations last when sorting by fastest", () => {
    const unknown = offer({ id: "unknown", price: 100, airlines: ["ZZ"], minutes: null });
    expect(offerMinutes(unknown)).toBeNull();
    expect(ids(sortOffers([unknown, ...OFFERS], "duration")).at(-1)).toBe("unknown");
  });
});

describe("filterOptions", () => {
  it("counts what each option would give, respecting the other filters", () => {
    const options = filterOptions(OFFERS, { ...NO_FILTERS, maxPrice: 500 });
    expect(options.stops).toEqual({ any: 3, "0": 1, "1": 2, "2": 3 });
    expect(options.departure).toEqual({ night: 1, morning: 1, afternoon: 0, evening: 1 });
    expect(options.airlines.find((a) => a.name === "BA")?.count).toBe(1);
  });

  it("doesn't let a filter's own choice zero out its other options", () => {
    expect(filterOptions(OFFERS, { ...NO_FILTERS, stops: "0" }).stops["1"]).toBe(3);
  });

  it("gives the full price range regardless of the filters", () => {
    expect(filterOptions(OFFERS, { ...NO_FILTERS, maxPrice: 300 })).toMatchObject({ minPrice: 200, maxPrice: 800 });
  });
});
