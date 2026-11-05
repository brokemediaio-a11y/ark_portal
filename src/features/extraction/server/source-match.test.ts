import { describe, expect, it } from "vitest";
import { amountInSource, currencyInSource, dateInSource, durationInSource, flightNumberInSource, mentionsStops, mentionsTravellers, timeInSource, yearInSource } from "./source-match";

describe("flightNumberInSource", () => {
  it("accepts formatting differences", () => {
    expect(flightNumberInSource("TK 1954", "TURKISH AIRLINES, TK1954")).toBe(true);
    expect(flightNumberInSource("TK1954", "TURKISH AIRLINES, TK 1954")).toBe(true);
    expect(flightNumberInSource("EY 78", "EY0078 to Abu Dhabi")).toBe(true);
  });

  it("never accepts different digits, or a number inside a longer one", () => {
    expect(flightNumberInSource("TK 1953", "TURKISH AIRLINES, TK 1954")).toBe(false);
    expect(flightNumberInSource("TK 195", "TURKISH AIRLINES, TK 1954")).toBe(false);
    expect(flightNumberInSource("TK 706", "TURKISH AIRLINES, TK 707")).toBe(false);
  });

  it("checks the airline code too", () => {
    expect(flightNumberInSource("EK 706", "TK 706")).toBe(false);
  });
});

describe("timeInSource", () => {
  it("matches 24-hour and AM/PM forms", () => {
    expect(timeInSource("18:30", "DEC 10, 6:30 PM")).toBe(true);
    expect(timeInSource("00:55", "DEC 11, 12:55 AM")).toBe(true);
    expect(timeInSource("12:50", "JAN 10, 12:50 PM")).toBe(true);
    expect(timeInSource("03:35", "QR 611 0335 0545")).toBe(true);
    expect(timeInSource("18:30", "dep 18:30")).toBe(true);
  });

  it("catches AM/PM swaps and wrong minutes", () => {
    expect(timeInSource("06:30", "DEC 10, 6:30 PM")).toBe(false);
    expect(timeInSource("18:30", "DEC 10, 6:30 AM")).toBe(false);
    expect(timeInSource("20:50", "DEC 10, 6:30 PM")).toBe(false);
  });
});

describe("dateInSource / yearInSource", () => {
  it("finds dates in common formats, regardless of year", () => {
    for (const text of ["DEC 10, 6:30 PM", "THURSDAY, DECEMBER 10", "10DEC", "10 December 2026", "10/12/2026", "2026-12-10"])
      expect(dateInSource("2026-12-10", text)).toBe(true);
    expect(dateInSource("2026-12-11", "DEC 10")).toBe(false);
    expect(dateInSource("2026-12-10", "DEC 101")).toBe(false);
  });

  it("only counts a year printed with that date, not one in a print stamp", () => {
    expect(yearInSource("2027-01-10", "JAN 10, 8:45 AM")).toBe(false);
    expect(yearInSource("2026-01-10", "04/11/2026, 20:48 JAN 10")).toBe(false);
    expect(yearInSource("2027-01-10", "10 Jan 2027")).toBe(true);
    expect(yearInSource("2027-01-10", "January 10, 2027")).toBe(true);
    expect(yearInSource("2027-01-10", "10/01/27")).toBe(true);
  });
});

describe("other checks", () => {
  it("durations", () => {
    expect(durationInSource("3h 25m", "Time: 3h 25min")).toBe(true);
    expect(durationInSource("3h 25m", "03:25")).toBe(true);
    expect(durationInSource("3h 5m", "Time: 3h 25min")).toBe(false);
  });

  it("amounts", () => {
    expect(amountInSource(185000, "Total PKR 185,000")).toBe(true);
    expect(amountInSource(185000, "Total PKR 185,000.00")).toBe(true);
    expect(amountInSource(199.06, "Total €199.06")).toBe(true);
    expect(amountInSource(2400, "CO2 137.62kg")).toBe(false);
    expect(amountInSource(1850, "Total PKR 185,000")).toBe(false);
  });

  it("currencies", () => {
    expect(currencyInSource("EUR", "Total €199.06")).toBe(true);
    expect(currencyInSource("PKR", "PKR 185,000")).toBe(true);
    expect(currencyInSource("EUR", "Economy, 137.62kg")).toBe(false);
    expect(currencyInSource("USD", "$500")).toBe(false);
  });

  it("travellers and stops only count when mentioned", () => {
    expect(mentionsTravellers("2 ADT 1 INF")).toBe(true);
    expect(mentionsTravellers("TURKISH AIRLINES, TK 1954 Economy")).toBe(false);
    expect(mentionsStops("Non-stop")).toBe(true);
    expect(mentionsStops("TURKISH AIRLINES, TK 1954 Economy")).toBe(false);
  });
});
