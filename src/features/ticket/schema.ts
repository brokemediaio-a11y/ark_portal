import { z } from "zod";
import { flightSegmentSchema, reviewFlagSchema } from "@/features/quotation/schema";

/** An Ark e-ticket, converted from a supplier's ticket. Stored like a quotation. */

const optionalText = z
  .string()
  .trim()
  .nullable()
  .transform((v) => (v ? v : null));

export const PASSENGER_TYPES = ["adult", "child", "infant"] as const;
export const TICKET_STATUSES = ["draft", "ready", "sent"] as const;
export const TICKET_SOURCE_TYPES = ["upload", "manual", "demo"] as const;

export const ticketSegmentSchema = flightSegmentSchema.extend({
  departureTerminal: optionalText,
  arrivalTerminal: optionalText,
  bookingClass: optionalText,
  bookingStatus: optionalText,
});

export const ticketPassengerSchema = z.object({
  id: z.string(),
  name: optionalText,
  type: z.enum(PASSENGER_TYPES).nullable(),
  /** YYYY-MM-DD */
  dateOfBirth: optionalText,
  ticketNumber: optionalText,
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
  reviewFlags: z.array(reviewFlagSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TicketSegment = z.infer<typeof ticketSegmentSchema>;
export type TicketPassenger = z.infer<typeof ticketPassengerSchema>;
export type PassengerType = TicketPassenger["type"];
export type Ticket = z.infer<typeof ticketSchema>;
export type TicketStatus = Ticket["status"];
