import { describe, expect, it } from "vitest";
import { createEmptySegment, createEmptyQuotation } from "./factory";
import { reviewFlightSequence, reviewQuotation } from "./review";
import { createEmptyTicket } from "@/features/ticket/factory";
import { reviewTicket } from "@/features/ticket/review";

const first = () => ({ ...createEmptySegment(), originCode: "KBL", destinationCode: "DOH", departureDate: "2027-01-13", departureTime: "19:30", arrivalDate: "2027-01-13", arrivalTime: "22:00" });
const next = () => ({ ...createEmptySegment(), originCode: "DOH", destinationCode: "AMS", departureDate: "2027-01-14", departureTime: "08:25", arrivalDate: "2027-01-14", arrivalTime: "13:20" });
describe("flight sequence review", () => {
  it("accepts the correct return connection", () => {
    expect(reviewFlightSequence([first(), next()])).toEqual([]);
  });
  it("blocks impossible connections using local times at the same airport", () => {
    const segments = [first(), { ...next(), departureDate: "2027-01-13", departureTime: "21:00" }];
    expect(reviewFlightSequence(segments)).toEqual([expect.objectContaining({ field: "segments.1.departureTime", level: "blocking" })]);
    const quotation = { ...createEmptyQuotation(), segments };
    const ticket = createEmptyTicket(); ticket.segments = segments.map(segment => ({ ...ticket.segments[0], ...segment }));
    expect(reviewQuotation(quotation, "2026-11-09")).toContainEqual(expect.objectContaining({ field: "segments.1.departureTime", level: "blocking" }));
    expect(reviewTicket(ticket, "2026-11-09")).toContainEqual(expect.objectContaining({ field: "segments.1.departureTime", level: "blocking" }));
  });
  it("asks for review of disconnected routes without blocking legitimate separate transfers", () => {
    const result = reviewFlightSequence([next(), first()]);
    expect(result[0]).toMatchObject({ field: "segments.1.originCode", level: "warning" });
    expect(result[0].message).toContain("flight sequence");
  });
  it("does not infer time zones or order flights with missing airport codes", () => {
    expect(reviewFlightSequence([{ ...first(), destinationCode: null }, next()])).toEqual([]);
  });
});
