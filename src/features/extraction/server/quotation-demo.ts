import "server-only";
import type { Extraction } from "../schema";

/**
 * Deterministic DEMO extraction for local development without an AI key.
 * The UI labels every quotation created this way as demo data.
 */
export const DEMO_EXTRACTION: Extraction = {
  documentHasFlightDetails: true,
  segments: [
    {
      airlineName: "Demo Airways",
      airlineCode: "DA",
      flightNumber: "DA 101",
      originCode: "LHE",
      originName: "Lahore",
      destinationCode: "DXB",
      destinationName: "Dubai",
      departureDate: "2026-12-10",
      departureTime: "04:15",
      arrivalDate: "2026-12-10",
      arrivalTime: "06:45",
      duration: "3h 30m",
      stops: 0,
      cabin: "Economy",
      baggage: "30 kg checked",
    },
    {
      airlineName: "Demo Airways",
      airlineCode: "DA",
      flightNumber: "DA 102",
      originCode: "DXB",
      originName: "Dubai",
      destinationCode: "LHE",
      destinationName: "Lahore",
      departureDate: "2026-12-17",
      departureTime: "22:10",
      arrivalDate: "2026-12-18",
      arrivalTime: null,
      duration: null,
      stops: 0,
      cabin: "Economy",
      baggage: null,
    },
  ],
  passengers: { adults: 2, children: null, infants: null },
  currency: "PKR",
  baseAmount: null,
  taxAmount: null,
  totalAmount: 185000,
  fareConditions: null,
  sourceReference: "DEMO-REF-001",
  customerName: null,
  uncertainFields: [
    {
      field: "segments.1.arrivalTime",
      reason: "Arrival time on the return flight was not legible.",
      evidence: null,
    },
  ],
};
