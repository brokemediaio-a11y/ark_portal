import { describe, expect, it } from "vitest";
import type { ExtractedSegment, Extraction } from "../schema";
import { resolveAssumedYears } from "./assumed-years";
import { groundInSourceText } from "./grounding";
import { checkAgainstReads, checkItinerary, mergeRepeatedFlights } from "./verification";

/** The text of the real Sabre itinerary that exposed the flight mix-up. */
const SABRE = `04/11/2026, 20:48 Sabre Red Web
THURSDAY, DECEMBER 10
AMSTERDAM TO ISTANBUL AIRPORT
TURKISH AIRLINES, TK 1954
CONFIRMED, Confirmation#: DCTK
AMS - AMSTERDAM, NETHERLANDS DEC 10, 6:30 PM | IST - ISTANBUL AIRPORT, TURKIYE DEC 10, 11:55 PM
Cabin: Economy | Time: 3h 25min
layover 1h 0m - Istanbul Airport, Turkiye
FRIDAY, DECEMBER 11
TURKISH AIRLINES, TK 706
IST - ISTANBUL AIRPORT, TURKIYE DEC 11, 12:55 AM | KBL - KABUL, AFGHANISTAN DEC 11, 7:15 AM
Cabin: Economy | Time: 4h 50min
SUNDAY, JANUARY 10
TURKISH AIRLINES, TK 707
KBL - KABUL, AFGHANISTAN JAN 10, 8:45 AM | IST - ISTANBUL AIRPORT, TURKIYE JAN 10, 12:50 PM
Cabin: Economy | Time: 5h 35min
TURKISH AIRLINES, TK 1953
IST - ISTANBUL AIRPORT, TURKIYE JAN 10, 3:25 PM | AMS - AMSTERDAM, NETHERLANDS JAN 10, 5:05 PM
Cabin: Economy | Time: 3h 40min`;

const segment = (over: Partial<ExtractedSegment>): ExtractedSegment => ({
  airlineName: "TURKISH AIRLINES", airlineCode: "TK", flightNumber: "TK 1954", originCode: "AMS", originName: "AMSTERDAM",
  destinationCode: "IST", destinationName: "ISTANBUL AIRPORT", departureDate: "2026-12-10", departureTime: "18:30",
  arrivalDate: "2026-12-10", arrivalTime: "23:55", duration: "3h 25min", stops: null, cabin: "Economy", baggage: null,
  ...over,
});

const extraction = (segments: ExtractedSegment[], over: Partial<Extraction> = {}): Extraction => ({
  documentHasFlightDetails: true, segments, passengers: { adults: null, children: null, infants: null },
  currency: null, baseAmount: null, taxAmount: null, totalAmount: null, fareConditions: null,
  sourceReference: null, customerName: null, uncertainFields: [], ...over,
});

const flagged = (data: Extraction) => data.uncertainFields.map((f) => f.field);

describe("groundInSourceText on the Sabre itinerary", () => {
  it("keeps a correct reading untouched", () => {
    const out = groundInSourceText(extraction([segment({})]), SABRE);
    expect(out.segments[0]).toEqual(segment({}));
    expect(flagged(out)).toEqual([]);
  });

  it("removes and flags the invented values from the original bug", () => {
    const invented = segment({ flightNumber: "TK 1951", departureTime: "20:50", duration: "3h 5m", stops: 0, baggage: "1 piece" });
    const out = groundInSourceText(extraction([invented], { currency: "EUR", totalAmount: 2400, passengers: { adults: 1, children: 0, infants: 0 } }), SABRE);
    expect(out.segments[0]).toMatchObject({ flightNumber: null, departureTime: null, duration: null, stops: null, baggage: null });
    expect(out).toMatchObject({ currency: null, totalAmount: null, passengers: { adults: null, children: null, infants: null } });
    expect(flagged(out)).toEqual(["segments.0.flightNumber", "segments.0.departureTime", "sourceTotal"]);
  });
});

describe("checkAgainstReads", () => {
  it("flags a critical value that only one reading supports, without removing it", () => {
    const out = checkAgainstReads(extraction([segment({})]), [SABRE, SABRE.replace("TK 1954", "TK 1951")]);
    expect(flagged(out)).toEqual(["segments.0.flightNumber"]);
    expect(out.segments[0].flightNumber).toBe("TK 1954");
  });

  it("stays quiet when both readings agree", () => {
    expect(flagged(checkAgainstReads(extraction([segment({})]), [SABRE, SABRE]))).toEqual([]);
  });
});

describe("mergeRepeatedFlights", () => {
  it("merges a flight repeated by overlapping page slices, keeping flags on the right flights", () => {
    const next = segment({ flightNumber: "TK 706", originCode: "IST", destinationCode: "KBL" });
    const flag = (field: string) => ({ field, reason: "check", evidence: null });
    const out = mergeRepeatedFlights(extraction([segment({}), segment({}), next], { uncertainFields: [flag("segments.1.cabin"), flag("segments.2.cabin"), flag("currency")] }));
    expect(out.segments.map((s) => s.flightNumber)).toEqual(["TK 1954", "TK 706"]);
    expect(flagged(out)).toEqual(["segments.1.cabin", "currency"]);
  });
});

describe("checkItinerary", () => {
  it("accepts a return flight once its year is resolved", () => {
    const out = extraction([segment({ flightNumber: "TK 706", originCode: "IST", destinationCode: "KBL", departureDate: "2026-12-11", arrivalDate: "2026-12-11" }), segment({ flightNumber: "TK 707", originCode: "KBL", destinationCode: "IST", departureDate: "2026-01-10", arrivalDate: "2026-01-10" })]);
    expect(flagged(checkItinerary(resolveAssumedYears(out, "2026-11-06", SABRE))).filter((f) => f.endsWith("departureTime"))).toEqual([]);
  });

  it("flags a connection that departs before the previous flight lands", () => {
    const next = segment({ flightNumber: "TK 706", originCode: "IST", destinationCode: "KBL", departureDate: "2026-12-10", departureTime: "20:00", arrivalDate: "2026-12-11", arrivalTime: "03:00" });
    expect(flagged(checkItinerary(extraction([segment({}), next])))).toEqual(["segments.1.departureTime"]);
  });

  it("flags the same flight number on two routes", () => {
    const back = segment({ flightNumber: "TK 706", originCode: "KBL", destinationCode: "IST", departureDate: "2027-01-10", arrivalDate: "2027-01-10" });
    const out = checkItinerary(extraction([segment({ flightNumber: "TK 706", originCode: "IST", destinationCode: "KBL" }), back]));
    expect(flagged(out)).toEqual(["segments.1.flightNumber"]);
  });

  it("flags an arrival date before departure", () => {
    expect(flagged(checkItinerary(extraction([segment({ arrivalDate: "2026-12-09" })])))).toEqual(["segments.0.arrivalDate"]);
  });
});

describe("resolveAssumedYears with the document text", () => {
  it("moves a past date even when the AI didn't flag the year, and asks staff to confirm", () => {
    const back = segment({ flightNumber: "TK 707", departureDate: "2026-01-10", arrivalDate: "2026-01-10" });
    const out = resolveAssumedYears(extraction([back]), "2026-11-06", SABRE);
    expect(out.segments[0]).toMatchObject({ departureDate: "2027-01-10", arrivalDate: "2027-01-10" });
    expect(out.uncertainFields[0].reason).toContain("2027 was assumed");
  });

  it("never changes a year the document prints", () => {
    const out = resolveAssumedYears(extraction([segment({ departureDate: "2026-01-10" })]), "2026-11-06", "TK 1954 on 10 Jan 2026");
    expect(out.segments[0].departureDate).toBe("2026-01-10");
    expect(out.uncertainFields).toEqual([]);
  });
});
