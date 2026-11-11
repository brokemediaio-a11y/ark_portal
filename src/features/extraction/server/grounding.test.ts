import { describe, expect, it } from "vitest";
import type { Extraction } from "../schema";
import { groundInSourceText } from "./grounding";

const SOURCE = "Ref: SKW-88412\n1. QR 611  Y  12JAN  LHEDOH  0335 0545  Non-stop  Bag 30KG";

const extraction = (segment: Partial<Extraction["segments"][number]>): Extraction => ({
  documentHasFlightDetails: true,
  segments: [
    {
      airlineName: null, airlineCode: "QR", flightNumber: "QR 611", originCode: "LHE", originName: null,
      destinationCode: "DOH", destinationName: null, departureDate: "2027-01-12", departureTime: "03:35",
      arrivalDate: "2027-01-12", arrivalTime: "05:45", duration: null, stops: 0, cabin: "Y", handCarry: null, checkIn: "30 KG",
      ...segment,
    },
  ],
  passengers: { adults: 1, children: null, infants: null },
  currency: "PKR", baseAmount: null, taxAmount: null, totalAmount: 1000, fareConditions: null,
  sourceReference: "SKW-88412", customerName: "Mr Invented", uncertainFields: [],
});

describe("groundInSourceText", () => {
  it("removes names the document never printed", () => {
    const out = groundInSourceText(extraction({ airlineName: "Qatar Airways", originName: "Lahore", destinationName: "Doha" }), SOURCE);
    expect(out.segments[0]).toMatchObject({ airlineName: null, originName: null, destinationName: null });
    expect(out.customerName).toBeNull();
  });

  it("keeps printed values despite spacing/punctuation differences", () => {
    const out = groundInSourceText(extraction({ flightNumber: "QR611", checkIn: "30 KG", cabin: "Y" }), SOURCE);
    expect(out.segments[0]).toMatchObject({ flightNumber: "QR611", checkIn: "30 KG", cabin: "Y" });
    expect(out.sourceReference).toBe("SKW-88412");
  });
});
