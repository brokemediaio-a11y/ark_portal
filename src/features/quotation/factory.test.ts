import { describe, expect, it } from "vitest";
import type { Extraction } from "@/features/extraction/schema";
import fixture from "@/features/flights/server/providers/duffel/__fixtures__/duffel-offers.test-mode.json";
import { toOffer } from "@/features/flights/server/providers/duffel/normalize";
import { rawOfferSchema } from "@/features/flights/server/providers/duffel/raw-schemas";
import { quotationFromExtraction, quotationFromFlightOffer } from "./factory";
import { quotationSchema } from "./schema";

const segment = (overrides: Partial<Extraction["segments"][number]> = {}): Extraction["segments"][number] => ({
  airlineName: "Emirates",
  airlineCode: "ek",
  flightNumber: "EK 623",
  originCode: "lhe",
  originName: "Lahore",
  destinationCode: "DXB",
  destinationName: "Dubai",
  departureDate: "2026-12-10",
  departureTime: "4:15",
  arrivalDate: "2026-12-10",
  arrivalTime: "06:45",
  duration: null,
  stops: 0,
  cabin: "Economy",
  handCarry: null,
  checkIn: null,
  ...overrides,
});

const extraction = (overrides: Partial<Extraction> = {}): Extraction => ({
  documentHasFlightDetails: true,
  segments: [segment()],
  passengers: { adults: 2, children: null, infants: null },
  currency: "pkr",
  baseAmount: null,
  taxAmount: null,
  totalAmount: 185000,
  fareConditions: null,
  sourceReference: " REF-1 ",
  customerName: null,
  uncertainFields: [],
  ...overrides,
});

describe("quotationFromExtraction", () => {
  it("normalizes codes and times and produces a valid quotation", () => {
    const q = quotationFromExtraction(extraction(), { fileName: "quote.pdf", demo: false });
    expect(quotationSchema.safeParse(q).success).toBe(true);
    expect(q.segments[0]).toMatchObject({ originCode: "LHE", airlineCode: "EK", departureTime: "04:15" });
    expect(q.currency).toBe("PKR");
    expect(q.sourceReference).toBe("REF-1");
    expect(q.sourceType).toBe("upload");
    expect(q.reviewFlags).toEqual([]);
  });

  it("drops badly formatted values and flags them instead of guessing", () => {
    const q = quotationFromExtraction(
      extraction({ segments: [segment({ originCode: "Lahore Intl", departureDate: "10 Dec" })], currency: "Rs" }),
      { fileName: null, demo: false },
    );
    expect(q.segments[0].originCode).toBeNull();
    expect(q.segments[0].departureDate).toBeNull();
    expect(q.currency).toBeNull();
    expect(q.reviewFlags.map((f) => f.field)).toEqual(["segments.0.originCode", "segments.0.departureDate", "currency"]);
    expect(q.reviewFlags[0].evidence).toBe("Lahore Intl");
  });

  it("keeps AI uncertainty flags and rejects negative prices", () => {
    const q = quotationFromExtraction(
      extraction({
        totalAmount: -5,
        uncertainFields: [{ field: "segments.0.arrivalTime", reason: "blurry", evidence: " 6:4? " }],
      }),
      { fileName: null, demo: true },
    );
    expect(q.sourceTotal).toBeNull();
    expect(q.sourceType).toBe("demo");
    expect(q.reviewFlags).toEqual([{ field: "segments.0.arrivalTime", reason: "blurry", evidence: "6:4?" }]);
  });
});

describe("quotationFromFlightOffer (real Duffel test-mode offer)", () => {
  const offer = toOffer(rawOfferSchema.parse(fixture.connecting), fixture.offer_request_id, "duffel");
  const q = quotationFromFlightOffer(offer, {
    providerLabel: "Duffel (test mode)",
    refreshedAt: "2026-11-01T18:40:00.000Z",
    passengers: { adults: 1, children: null, infants: null },
  });

  it("is a valid quotation priced from the provider total", () => {
    expect(quotationSchema.safeParse(q).success).toBe(true);
    expect(q).toMatchObject({ sourceType: "flight_search", currency: "EUR", sourceTotal: 1229.02, baseAmount: 717.49, taxAmount: 511.53 });
  });

  it("keeps an immutable snapshot of the provider offer", () => {
    expect(q.providerSnapshot).toEqual({
      provider: "duffel",
      offerRequestId: fixture.offer_request_id,
      offerId: "off_034qB9UGF4Gl9r58LkQhgu",
      liveMode: false,
      totalAmount: 1229.02,
      totalCurrency: "EUR",
      expiresAt: fixture.connecting.expires_at,
      refreshedAt: "2026-11-01T18:40:00.000Z",
    });
  });

  it("lists every flight of every slice with local times, cabin and baggage", () => {
    expect(q.segments.map((s) => [s.flightNumber, s.originCode, s.destinationCode, s.departureDate, s.departureTime, s.arrivalDate, s.arrivalTime])).toEqual([
      ["EY 78", "MAN", "AUH", "2026-11-02", "08:15", "2026-11-02", "19:25"],
      ["EY 310", "AUH", "KBL", "2026-11-03", "14:45", "2026-11-03", "18:15"],
      ["EY 313", "KBL", "AUH", "2026-11-12", "15:00", "2026-11-12", "18:00"],
      ["EY 75", "AUH", "MAN", "2026-11-13", "14:00", "2026-11-13", "18:00"],
    ]);
    expect(q.segments[0]).toMatchObject({ airlineName: "Etihad Airways", originName: "Manchester", cabin: "Economy", handCarry: "1 bag", checkIn: "None" });
  });
});

describe("saved quotations from before sourceProvider existed", () => {
  it("still load", () => {
    const legacy: Record<string, unknown> = { ...quotationFromExtraction(extraction(), { fileName: null, demo: false }) };
    delete legacy.sourceProvider;
    const parsed = quotationSchema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.sourceProvider).toBeNull();
  });
});
