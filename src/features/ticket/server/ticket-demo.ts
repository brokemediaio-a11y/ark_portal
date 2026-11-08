import "server-only";
import type { TicketExtraction } from "../extraction-schema";

/** Fixed DEMO ticket for local development without an AI key. The UI labels it as demo data. */
export const DEMO_TICKET: TicketExtraction = {
  documentHasTicketDetails: true,
  bookingReference: "DEMO42",
  airlineReference: null,
  issueDate: "2026-11-01",
  issueDateAsPrinted: "01NOV26",
  issuedBy: "Demo Airways",
  passengers: [
    { name: "DEMO/PASSENGER MR", type: "Adult", dateOfBirth: null, ticketNumber: "000 1234567890" },
  ],
  segments: [
    {
      airlineName: "Demo Airways", airlineCode: "DA", flightNumber: "DA 101", originCode: "ARN", originName: "Stockholm",
      destinationCode: "IST", destinationName: "Istanbul", departureDate: "2026-12-10", departureTime: "18:35",
      arrivalDate: "2026-12-10", arrivalTime: "23:15", duration: null, stops: null, cabin: "Economy", baggage: "20 kg",
      departureTerminal: "5", arrivalTerminal: null, bookingClass: "Y", bookingStatus: "OK",
    },
  ],
  fareConditions: null,
  uncertainFields: [],
};
