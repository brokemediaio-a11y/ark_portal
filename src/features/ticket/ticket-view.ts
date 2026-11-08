import { brand } from "@/config/brand";
import { formatIsoDate, routeSummaryOf, toCustomerSegment, type CustomerSegment } from "@/features/quotation/customer-view";
import type { PassengerType, Ticket } from "./schema";

/**
 * The traveller-facing view of an e-ticket. The PDF is built only from this
 * object, so internal notes such as review flags or source files never reach it.
 */
export interface CustomerTicket {
  /** Printed across the PDF when the data isn't real (demo extraction). */
  watermark: string | null;
  ticketRef: string;
  bookingReference: string | null;
  airlineReference: string | null;
  issueDate: string | null;
  issuedBy: string | null;
  routeSummary: string;
  passengers: { name: string; type: string | null; dateOfBirth: string | null; ticketNumber: string | null }[];
  segments: CustomerSegment[];
  fareConditions: string | null;
  notes: string | null;
  terms: string[];
}

export const PASSENGER_TYPE_LABELS: Record<NonNullable<PassengerType>, string> = { adult: "Adult", child: "Child", infant: "Infant" };

const lines = (text: string | null) => (text ?? "").split("\n").map((t) => t.trim()).filter(Boolean);

export function buildCustomerTicket(t: Ticket): CustomerTicket {
  return {
    watermark: t.sourceType === "demo" ? "DEMO DATA — NOT A REAL TICKET" : null,
    ticketRef: t.ticketRef,
    bookingReference: t.bookingReference,
    airlineReference: t.airlineReference,
    issueDate: formatIsoDate(t.issueDate),
    issuedBy: t.issuedBy,
    routeSummary: routeSummaryOf(t.segments),
    passengers: t.passengers.flatMap((p) =>
      p.name ? [{ name: p.name, type: p.type ? PASSENGER_TYPE_LABELS[p.type] : null, dateOfBirth: formatIsoDate(p.dateOfBirth), ticketNumber: p.ticketNumber }] : [],
    ),
    segments: t.segments.map((s, i) => {
      const segment = toCustomerSegment(s, i);
      const travelClass = s.cabin && s.bookingClass ? `${s.cabin} (${s.bookingClass})` : (s.cabin ?? s.bookingClass);
      return {
        ...segment,
        from: { ...segment.from, terminal: s.departureTerminal },
        to: { ...segment.to, terminal: s.arrivalTerminal },
        details: [travelClass && `Class: ${travelClass}`, s.baggage && `Baggage: ${s.baggage}`, s.bookingStatus && `Status: ${s.bookingStatus}`].filter(
          (v): v is string => Boolean(v),
        ),
      };
    }),
    fareConditions: t.fareConditions,
    notes: t.notes,
    terms: lines(brand.ticketNotes),
  };
}
