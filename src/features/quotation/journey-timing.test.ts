import { describe, expect, it } from "vitest";
import { createEmptySegment } from "./factory";
import { airportInstant, connectionBetween, flightDuration } from "./journey-timing";
import { buildCustomerQuote } from "./customer-view";
import { createEmptyQuotation } from "./factory";
import { createEmptyTicket } from "@/features/ticket/factory";
import { buildCustomerTicket } from "@/features/ticket/ticket-view";

const flight = (origin: string, destination: string, departure: string, arrival: string) => ({
  ...createEmptySegment(), originCode: origin, destinationCode: destination,
  departureDate: departure.slice(0, 10), departureTime: departure.slice(11),
  arrivalDate: arrival.slice(0, 10), arrivalTime: arrival.slice(11),
});
const journey = () => [
  flight("AMS", "DOH", "2026-12-12T15:05", "2026-12-12T23:20"),
  flight("DOH", "KBL", "2026-12-13T03:00", "2026-12-13T08:10"),
  flight("KBL", "DOH", "2027-01-13T19:30", "2027-01-13T22:00"),
  flight("DOH", "AMS", "2027-01-14T08:25", "2027-01-14T13:20"),
];

describe("flight duration and connections", () => {
  it("calculates the four ticket durations using airport time zones, including Kabul's half-hour offset", () => {
    expect(journey().map(flightDuration)).toEqual(["6h 15m", "3h 40m", "4h", "6h 55m"]);
  });
  it("keeps a duration printed by the supplier or returned by the flight provider", () => {
    expect(flightDuration({ ...journey()[0], duration: "6h 10min" })).toBe("6h 10min");
  });
  it("uses the travel date's DST offset rather than today's offset", () => {
    expect(flightDuration(flight("AMS", "DOH", "2026-07-12T15:05", "2026-07-12T23:20"))).toBe("7h 15m");
  });
  it("calculates overnight connections and distinguishes a destination stay", () => {
    const legs = journey();
    expect(connectionBetween(legs[0], legs[1])).toMatchObject({ kind: "layover", location: "DOH", duration: "3h 40m" });
    expect(connectionBetween(legs[1], legs[2])).toMatchObject({ kind: "stay", location: "KBL", duration: "31d 11h 20m" });
    expect(connectionBetween(legs[2], legs[3])).toMatchObject({ kind: "layover", location: "DOH", duration: "10h 25m" });
  });
  it("handles daylight saving changes during a layover", () => {
    const first = { ...journey()[0], destinationCode: "AMS", arrivalDate: "2026-03-29", arrivalTime: "01:30" };
    const next = { ...journey()[1], originCode: "AMS", departureDate: "2026-03-29", departureTime: "03:30" };
    expect(connectionBetween(first, next).duration).toBe("1h");
  });
  it("does not guess ambiguous or nonexistent local times, invalid dates, or unknown airports", () => {
    expect(airportInstant("AMS", "2026-10-25", "02:30")).toBeNull();
    expect(airportInstant("AMS", "2026-03-29", "02:30")).toBeNull();
    expect(airportInstant("AMS", "2026-02-30", "10:00")).toBeNull();
    expect(airportInstant("XXX", "2026-12-12", "15:05")).toBeNull();
    expect(flightDuration({ ...journey()[0], originCode: null })).toBeNull();
    expect(flightDuration({ ...journey()[0], arrivalDate: "2027-12-12" })).toBeNull();
  });
  it("does not label airport changes or negative connections as a layover", () => {
    const legs = journey();
    expect(connectionBetween(legs[0], { ...legs[1], originCode: "DXB" })).toMatchObject({ kind: "transfer", duration: null });
    expect(connectionBetween(legs[0], { ...legs[1], departureDate: "2026-12-12", departureTime: "22:00" })).toMatchObject({ kind: "invalid", duration: null });
    expect(connectionBetween(legs[0], { ...legs[1], departureTime: null })).toMatchObject({ kind: "unknown", duration: null });
  });
  it("provides the same connection and duration data to quotations and tickets", () => {
    const quotation = { ...createEmptyQuotation(), segments: journey() };
    const ticket = createEmptyTicket(); ticket.segments = journey().map(leg => ({ ...ticket.segments[0], ...leg }));
    const quoteView = buildCustomerQuote(quotation); const ticketView = buildCustomerTicket(ticket);
    expect(quoteView.segments.map(leg => leg.duration)).toEqual(ticketView.segments.map(leg => leg.duration));
    expect(quoteView.segments.map(leg => leg.connectionBefore)).toEqual(ticketView.segments.map(leg => leg.connectionBefore));
    expect(quoteView.segments[0].connectionBefore).toBeNull();
  });
});
