import { describe, expect, it } from "vitest";
import { createEmptyQuotation } from "./factory";
import { hasBlockingIssues, reviewQuotation } from "./review";
import type { Quotation } from "./schema";

const TODAY = "2026-10-25";

function completeQuotation(): Quotation {
  const q = createEmptyQuotation();
  q.segments[0] = {
    ...q.segments[0],
    airlineName: "Emirates",
    flightNumber: "EK 623",
    originCode: "LHE",
    destinationCode: "DXB",
    departureDate: "2026-12-10",
    departureTime: "04:15",
    arrivalDate: "2026-12-10",
    arrivalTime: "06:45",
  };
  q.currency = "PKR";
  q.sourceTotal = 100000;
  q.customer.name = "Ahmed Khan";
  return q;
}

describe("reviewQuotation", () => {
  it("has no issues for a complete quotation", () => {
    expect(reviewQuotation(completeQuotation(), TODAY)).toEqual([]);
  });

  it("blocks when required data is missing", () => {
    const issues = reviewQuotation(createEmptyQuotation(), TODAY);
    expect(hasBlockingIssues(issues)).toBe(true);
    const blockingFields = issues.filter((i) => i.level === "blocking").map((i) => i.field);
    expect(blockingFields).toEqual(
      expect.arrayContaining(["segments.0.originCode", "segments.0.destinationCode", "segments.0.departureDate", "currency", "sourceTotal"]),
    );
  });

  it("accepts a city name when the airport code is unknown", () => {
    const q = completeQuotation();
    q.segments[0].originCode = null;
    q.segments[0].originName = "Lahore";
    expect(hasBlockingIssues(reviewQuotation(q, TODAY))).toBe(false);
  });

  it("blocks invalid formats and impossible dates", () => {
    const q = completeQuotation();
    q.segments[0].originCode = "LAHORE";
    q.segments[0].arrivalDate = "2026-12-09";
    const fields = reviewQuotation(q, TODAY).filter((i) => i.level === "blocking").map((i) => i.field);
    expect(fields).toEqual(["segments.0.originCode", "segments.0.arrivalDate"]);
  });

  it("surfaces AI review flags as warnings, not blockers", () => {
    const q = completeQuotation();
    q.reviewFlags = [{ field: "segments.0.departureTime", reason: "unclear", evidence: null }];
    const issues = reviewQuotation(q, TODAY);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ field: "segments.0.departureTime", level: "warning" });
  });
});

describe("past dates", () => {
  it("blocks a departure date before today (e.g. a wrongly assumed year)", () => {
    const q = completeQuotation();
    q.segments[0].departureDate = "2024-03-14";
    q.segments[0].arrivalDate = "2024-03-14";
    const issue = reviewQuotation(q, TODAY).find((i) => i.field === "segments.0.departureDate");
    expect(issue?.level).toBe("blocking");
  });
});
