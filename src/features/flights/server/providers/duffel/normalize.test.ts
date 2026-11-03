import { describe, expect, it } from "vitest";
import { conditionsLabel, flightNumberLabel, minutesBetween, sliceStops } from "../../../format";
import fixture from "./__fixtures__/duffel-offers.test-mode.json";
import { getDuffelConfig } from "./config";
import { parseIsoDuration, toOffer, toOfferRequestBody } from "./normalize";
import { rawOfferSchema } from "./raw-schemas";

// Real responses captured from the Duffel test environment (MAN ⇄ KBL, Nov 2026).
const connecting = toOffer(rawOfferSchema.parse(fixture.connecting), fixture.offer_request_id, "duffel");
const direct = toOffer(rawOfferSchema.parse(fixture.direct), fixture.offer_request_id, "duffel");

describe("parseIsoDuration", () => {
  it.each([
    ["PT7H10M", 430],
    ["P1DT5H30M", 1770],
    ["PT45M", 45],
    ["PT2H", 120],
    [null, null],
    ["garbage", null],
  ])("%s → %s", (input, minutes) => expect(parseIsoDuration(input)).toBe(minutes));
});

describe("toOffer (real Duffel test-mode data)", () => {
  it("keeps price, currency, ids and test mode", () => {
    expect(connecting).toMatchObject({
      id: "off_034qB9UGF4Gl9r58LkQhgu",
      provider: "duffel",
      liveMode: false,
      totalAmount: 1229.02,
      totalCurrency: "EUR",
      baseAmount: 717.49,
      taxAmount: 511.53,
      owner: { iata: "EY", name: "Etihad Airways" },
    });
    expect(connecting.passengers[0].id).toMatch(/^pas_/);
  });

  it("models a connecting round trip as two slices with their segments and local times", () => {
    expect(connecting.slices.map((s) => [s.origin.iata, s.destination.iata, s.durationMinutes, sliceStops(s.segments)])).toEqual([
      ["MAN", "KBL", 1770, 1],
      ["KBL", "MAN", 1890, 1],
    ]);
    const [first, second] = connecting.slices[0].segments;
    expect(first).toMatchObject({ departingAt: "2026-11-02T08:15", arrivingAt: "2026-11-02T19:25", aircraft: "Boeing 777-300ER", cabin: "Economy" });
    expect(flightNumberLabel(first.marketing.iata, first.marketing.flightNumber)).toBe("EY 78");
    // Overnight connection in Abu Dhabi: 19:25 → 14:45 next day.
    expect(minutesBetween(first.arrivingAt, second.departingAt)).toBe(19 * 60 + 20);
  });

  it("reports baggage exactly as returned — no checked bag is 0, not unknown", () => {
    expect(connecting.slices[0].segments[0].baggage).toEqual({ checked: 0, carryOn: 1 });
    expect(direct.slices[0].segments[0].baggage).toEqual({ checked: 1, carryOn: 1 });
  });

  it("keeps missing fare rules as unknown instead of guessing", () => {
    expect(connecting.conditions).toEqual({ change: null, refund: null });
    expect(conditionsLabel(connecting.conditions)).toBeNull();
    expect(conditionsLabel(direct.conditions)).toBe("Changes before departure: not allowed. Refunds before departure: allowed (fee €70.00).");
  });
});

describe("toOfferRequestBody", () => {
  it("sends adults by type, children and infants by age, and the stop limit", () => {
    expect(
      toOfferRequestBody({
        slices: [{ origin: "LHE", destination: "DXB", departureDate: "2026-11-20" }],
        passengers: { adults: 2, childAges: [8], infantAges: [1] },
        cabinClass: "business",
        maxConnections: 0,
      }),
    ).toEqual({
      slices: [{ origin: "LHE", destination: "DXB", departure_date: "2026-11-20" }],
      passengers: [{ type: "adult" }, { type: "adult" }, { age: 8 }, { age: 1 }],
      cabin_class: "business",
      max_connections: 0,
    });
  });

  it("omits max_connections when any number of stops is allowed", () => {
    const body = toOfferRequestBody({
      slices: [{ origin: "MAN", destination: "KBL", departureDate: "2026-11-20" }],
      passengers: { adults: 1, childAges: [], infantAges: [] },
      cabinClass: "economy",
      maxConnections: null,
    });
    expect(body).not.toHaveProperty("max_connections");
  });
});

describe("getDuffelConfig safety guard", () => {
  const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

  it("accepts a test token in test mode", () => {
    expect(getDuffelConfig(env({ DUFFEL_ENV: "test", DUFFEL_TEST_ACCESS_TOKEN: "duffel_test_abc" }))).toMatchObject({ liveMode: false });
  });

  it("refuses a live token when configured for test", () => {
    expect(() => getDuffelConfig(env({ DUFFEL_ENV: "test", DUFFEL_TEST_ACCESS_TOKEN: "duffel_live_abc" }))).toThrow(
      expect.objectContaining({ code: "not_configured" }),
    );
  });

  it("requires a token", () => {
    expect(() => getDuffelConfig(env({ DUFFEL_ENV: "test" }))).toThrow(expect.objectContaining({ code: "not_configured" }));
  });
});
