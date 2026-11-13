import { z } from "zod";
import { brand } from "@/config/brand";
import { flightSegmentShape, reviewFlagSchema, withLegacyBaggage } from "@/features/quotation/schema";

/** An Ark e-ticket, converted from a supplier's ticket. Stored like a quotation. */

const optionalText = z
  .string()
  .trim()
  .nullable()
  .transform((v) => (v ? v : null));

export const PASSENGER_TYPES = ["adult", "child", "infant"] as const;
export const TICKET_STATUSES = ["draft", "ready", "sent"] as const;
export const TICKET_SOURCE_TYPES = ["upload", "manual", "demo"] as const;

export const ticketSegmentSchema = withLegacyBaggage(flightSegmentShape.extend({
  departureTerminal: optionalText,
  arrivalTerminal: optionalText,
  bookingClass: optionalText,
  bookingStatus: optionalText,
  /** This flight's booking reference when it differs between flights (several suppliers); otherwise the ticket's. */
  bookingReference: optionalText.default(null),
}));

export const ticketPassengerSchema = z.object({
  id: z.string(),
  name: optionalText,
  type: z.enum(PASSENGER_TYPES).nullable(),
  /** YYYY-MM-DD */
  dateOfBirth: optionalText,
  /** The e-ticket number, for every flight that has no number of its own below. */
  ticketNumber: optionalText,
  /** E-ticket numbers that only cover some flights, by flight (segment id): one traveller, several suppliers. */
  flightTicketNumbers: z.record(z.string(), z.string()).default({}),
});

export const ticketSchema = z.object({
  id: z.string(),
  ticketRef: z.string(),
  status: z.enum(TICKET_STATUSES),
  sourceType: z.enum(TICKET_SOURCE_TYPES),
  sourceFileNames: z.array(z.string()),
  bookingReference: optionalText,
  airlineReference: optionalText,
  /** YYYY-MM-DD */
  issueDate: optionalText,
  issuedBy: optionalText,
  passengers: z.array(ticketPassengerSchema),
  segments: z.array(ticketSegmentSchema),
  fareConditions: optionalText,
  notes: optionalText,
  /** "Important information" in English and Dari. Older tickets get the defaults. */
  infoText: optionalText.default(brand.ticketNotes),
  infoTextDari: optionalText.default(brand.ticketNotesDari),
  reviewFlags: z.array(reviewFlagSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TicketSegment = z.infer<typeof ticketSegmentSchema>;
export type TicketPassenger = z.infer<typeof ticketPassengerSchema>;
export type PassengerType = TicketPassenger["type"];
export type Ticket = z.infer<typeof ticketSchema>;
export type TicketStatus = Ticket["status"];
