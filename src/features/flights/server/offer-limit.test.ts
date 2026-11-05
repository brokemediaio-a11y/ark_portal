import { describe, expect, it } from "vitest";
import type { FlightOffer } from "../schema";
import { limitOffers } from "./offer-limit";

const offer = (id: string, price: number, airline: string, flights = 2) =>
  ({
    id,
    totalAmount: price,
    slices: [{ segments: Array.from({ length: flights }, () => ({ marketing: { iata: null, name: airline }, technicalStops: 0 })) }],
  }) as unknown as FlightOffer;

const flood = (count: number) => Array.from({ length: count }, (_, i) => offer(`cheap-${i}`, 100 + i, "Big Air"));

describe("limitOffers", () => {
  it("leaves results under the limit alone", () => {
    const offers = flood(10);
    expect(limitOffers(offers, 20)).toEqual(offers);
  });

  it("never returns more than the limit", () => {
    expect(limitOffers(flood(3000), 500)).toHaveLength(500);
  });

  it("keeps an expensive direct flight and a rare airline among cheap connections", () => {
    const out = limitOffers([...flood(3000), offer("direct", 9000, "Big Air", 1), offer("rare", 8000, "Rare Air")], 500);
    expect(out.map((o) => o.id)).toEqual(expect.arrayContaining(["direct", "rare"]));
    expect(out).toHaveLength(500);
  });

  it("otherwise prefers the cheapest, sorted by price", () => {
    const out = limitOffers(flood(3000), 100);
    expect(out[0].id).toBe("cheap-0");
    expect(out.at(-1)?.id).toBe("cheap-99");
  });
});
