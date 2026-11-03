import { describe, expect, it } from "vitest";
import { offerAirlines, offerBaggageLabel, soldByOther } from "./format";
import type { FlightOffer } from "./schema";

const offer = (owner: string, flights: { airline: string; checked: number }[]) =>
  ({
    owner: { iata: null, name: owner },
    slices: flights.map(({ airline, checked }) => ({
      segments: [{ marketing: { iata: null, name: airline, flightNumber: "1" }, baggage: { checked, carryOn: 1 } }],
    })),
  }) as unknown as FlightOffer;

describe("offerAirlines / soldByOther", () => {
  it("names the airline flown, and the seller separately (Hahn Air selling Kam Air, as returned by Duffel live)", () => {
    const o = offer("Hahn Air", [{ airline: "Kam Air", checked: 1 }]);
    expect(offerAirlines(o)).toEqual(["Kam Air"]);
    expect(soldByOther(o)).toBe("Hahn Air");
  });

  it("has no separate seller when the owner is one of the airlines flown", () => {
    expect(soldByOther(offer("Etihad Airways", [{ airline: "Etihad Airways", checked: 0 }]))).toBeNull();
  });
});

describe("offerBaggageLabel", () => {
  it("shows the allowance when every flight has the same one", () => {
    expect(offerBaggageLabel(offer("X", [{ airline: "X", checked: 1 }, { airline: "X", checked: 1 }]))).toBe("1 checked bag, 1 carry-on");
  });

  it("doesn't imply the first flight's allowance applies to all", () => {
    expect(offerBaggageLabel(offer("X", [{ airline: "X", checked: 2 }, { airline: "X", checked: 1 }]))).toBe("Baggage varies by flight");
  });
});
