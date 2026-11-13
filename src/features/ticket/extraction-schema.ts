import { z } from "zod";
import { extractedSegmentSchema } from "@/features/extraction/schema";

/**
 * Exact shape the AI must return for a supplier e-ticket. Like the quotation
 * schema, every field is required-but-nullable so "not printed" is explicit.
 */
const text = z.string().nullable();

export const extractedTicketSegmentSchema = extractedSegmentSchema.extend({
  departureTerminal: text.describe("Terminal as printed, without the word 'Terminal', e.g. 5"),
  arrivalTerminal: text,
  bookingClass: text.describe("Booking / reservation class letter(s), e.g. K or Y1"),
  bookingStatus: text.describe("e.g. OK, CONFIRMED"),
  bookingReference: text.describe("The booking reference / PNR printed for this flight, e.g. PTX09; the airline's booking reference over an agency order number"),
});

export const extractedTicketSchema = z.object({
  ticketNumber: text.describe("E-ticket number exactly as printed"),
  flightNumbers: z.array(z.string()).describe("Flight numbers this e-ticket covers, as printed; empty if it covers every flight of its document"),
});

export const extractedTicketPassengerSchema = z.object({
  name: text.describe("Exactly as printed, e.g. WROOR/MILA or NOORI / FARHAD"),
  type: text.describe("Passenger type only if printed: Adult, Child or Infant"),
  dateOfBirth: text.describe("YYYY-MM-DD, only if printed"),
  tickets: z.array(extractedTicketSchema).describe("Each e-ticket number of this traveller, with the flights it covers"),
});

export const ticketExtractionSchema = z.object({
  documentHasTicketDetails: z.boolean(),
  bookingReference: text.describe("Booking reference / PNR / reservation code"),
  airlineReference: text.describe("The airline's own reservation code, if printed separately"),
  issueDate: text.describe("YYYY-MM-DD; only a Gregorian date that is printed"),
  issueDateAsPrinted: text.describe("The issue date exactly as printed, in any calendar, e.g. 17 Sep 26 or 1405/07/15"),
  issuedBy: text.describe("Issuing airline or agency, as printed"),
  passengers: z.array(extractedTicketPassengerSchema),
  segments: z.array(extractedTicketSegmentSchema),
  fareConditions: text.describe("Refund/change conditions exactly as printed"),
  uncertainFields: z.array(
    z.object({
      field: z.string().describe('Path such as "segments.0.departureTime" or "passengers.1.tickets.0.ticketNumber"'),
      reason: z.string(),
      evidence: z.string().nullable(),
    }),
  ),
});

export type ExtractedTicketSegment = z.infer<typeof extractedTicketSegmentSchema>;
export type ExtractedTicketPassenger = z.infer<typeof extractedTicketPassengerSchema>;
export type ExtractedTicket = z.infer<typeof extractedTicketSchema>;
export type TicketExtraction = z.infer<typeof ticketExtractionSchema>;
