import { describe, expect, it } from "vitest";
import type { Extraction } from "../schema";
import { resolveAssumedYears } from "./assumed-years";

const TODAY = "2026-10-25";

function extraction(dates: [string, string][], flagged: number[]): Extraction {
  return {
    documentHasFlightDetails: true,
    segments: dates.map(([dep, arr]) => ({
      airlineName: null, airlineCode: null, flightNumber: null, originCode: null, originName: null,
      destinationCode: null, destinationName: null, departureDate: dep, departureTime: null,
      arrivalDate: arr, arrivalTime: null, duration: null, stops: null, cabin: null, handCarry: null, checkIn: null,
    })),
    passengers: { adults: 1, children: null, infants: null },
    currency: null, baseAmount: null, taxAmount: null, totalAmount: null, fareConditions: null,
    sourceReference: null, customerName: null,
    uncertainFields: flagged.map((i) => ({ field: `segments.${i}.departureDate`, reason: "year assumed", evidence: "14 Mar" })),
  };
}

describe("resolveAssumedYears", () => {
  it("moves flagged past dates to the next occurrence, keeping arrival consistent", () => {
    const out = resolveAssumedYears(extraction([["2024-03-14", "2024-03-15"], ["2024-12-30", "2024-12-30"]], [0, 1]), TODAY);
    expect(out.segments.map((s) => [s.departureDate, s.arrivalDate])).toEqual([
      ["2027-03-14", "2027-03-15"],
      ["2026-12-30", "2026-12-30"],
    ]);
    expect(out.uncertainFields[0].reason).toContain("2027 was assumed");
  });

  it("leaves unflagged dates alone (a printed past year is caught by review instead)", () => {
    const out = resolveAssumedYears(extraction([["2024-03-14", "2024-03-14"]], []), TODAY);
    expect(out.segments[0].departureDate).toBe("2024-03-14");
  });

  it("leaves flagged dates that are already upcoming", () => {
    const out = resolveAssumedYears(extraction([["2027-01-12", "2027-01-12"]], [0]), TODAY);
    expect(out.segments[0].departureDate).toBe("2027-01-12");
    expect(out.uncertainFields[0].reason).toContain("2027 was assumed");
  });

  it("asks staff to confirm once per assumed year, whatever the model flagged", () => {
    const data = extraction([["2026-12-10", "2026-12-10"], ["2026-12-11", "2026-12-11"], ["2026-01-10", "2026-01-10"], ["2026-01-10", "2026-01-10"]], [0, 2]);
    const out = resolveAssumedYears(data, TODAY, "DEC 10 | DEC 11 | JAN 10");
    expect(out.segments.map((s) => s.departureDate)).toEqual(["2026-12-10", "2026-12-11", "2027-01-10", "2027-01-10"]);
    expect(out.uncertainFields.map((f) => f.field)).toEqual(["segments.0.departureDate", "segments.2.departureDate"]);
  });
});
