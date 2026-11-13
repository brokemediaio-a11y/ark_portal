import { brand } from "@/config/brand";
import { formatIsoDate, noteLines, routeSummaryOf, toCustomerSegment, type CustomerSegment } from "@/features/quotation/customer-view";
import type { PassengerType, Ticket } from "./schema";

/** A flight as a small tag beside a reference or ticket number: its logo (or a plane) and number. */
export interface FlightTag {
  /** "Flight 1" */
  title: string;
  flightNumber: string | null;
  airlineName: string | null;
  airlineCode: string | null;
}

/** A booking reference, or one traveller's e-ticket number, with the flights it covers. */
export interface CoveredFlights {
  value: string;
  flights: FlightTag[];
}

export interface CustomerPassenger {
  name: string;
  type: string | null;
  dateOfBirth: string | null;
  /** One entry per e-ticket number; a traveller booked through several suppliers has several. */
  tickets: CoveredFlights[];
}

/**
 * The traveller-facing view of an e-ticket. The PDF is built only from this
 * object, so internal notes such as review flags or source files never reach it.
 */
export interface CustomerTicket {
  /** Printed across the PDF when the data isn't real (demo extraction). */
  watermark: string | null;
  ticketRef: string;
  /** The booking reference when every flight shares one; null when there are several (see bookings). */
  bookingReference: string | null;
  /** Every booking reference with its flights, in travel order. */
  bookings: CoveredFlights[];
  airlineReference: string | null;
  issueDate: string | null;
  /** Always Ark Travelers: the agency issues the ticket the traveller holds. */
  issuedBy: string;
  routeSummary: string;
  passengers: CustomerPassenger[];
  segments: CustomerSegment[];
  fareConditions: string | null;
  notes: string | null;
  /** Important information in Dari, printed beside the English. */
  termsDari: string[];
  terms: string[];
}

export const PASSENGER_TYPE_LABELS: Record<NonNullable<PassengerType>, string> = { adult: "Adult", child: "Child", infant: "Infant" };

/** Values in travel order, each with the flights it applies to. Flights with no value are left out. */
function groupFlights(values: (string | null)[], tags: FlightTag[]): CoveredFlights[] {
  const groups: CoveredFlights[] = [];
  values.forEach((value, i) => {
    if (!value) return;
    const group = groups.find((g) => g.value === value);
    if (group) group.flights.push(tags[i]);
    else groups.push({ value, flights: [tags[i]] });
  });
  return groups;
}

export function buildCustomerTicket(t: Ticket): CustomerTicket {
  const tags: FlightTag[] = t.segments.map((s, i) => ({
    title: `Flight ${i + 1}`,
    flightNumber: s.flightNumber,
    airlineName: s.airlineName,
    airlineCode: s.airlineCode,
  }));
  const references = t.segments.map((s) => s.bookingReference ?? t.bookingReference);
  const bookings = groupFlights(references, tags);
  const severalBookings = bookings.length > 1;

  return {
    watermark: t.sourceType === "demo" ? "DEMO DATA — NOT A REAL TICKET" : null,
    ticketRef: t.ticketRef,
    bookingReference: severalBookings ? null : (bookings[0]?.value ?? t.bookingReference),
    bookings,
    // Not repeated when it is already one of the booking references.
    airlineReference: t.airlineReference && !bookings.some((b) => b.value === t.airlineReference) ? t.airlineReference : null,
    issueDate: formatIsoDate(t.issueDate),
    issuedBy: brand.legalName,
    routeSummary: routeSummaryOf(t.segments),
    passengers: t.passengers.flatMap((p) => {
      if (!p.name) return [];
      const numbers = t.segments.map((s) => p.flightTicketNumbers[s.id] ?? p.ticketNumber);
      const tickets = groupFlights(numbers, tags);
      // A number with no flights to cover (no flights entered yet) is still the traveller's ticket.
      if (!tickets.length && p.ticketNumber) tickets.push({ value: p.ticketNumber, flights: [] });
      return [{ name: p.name, type: p.type ? PASSENGER_TYPE_LABELS[p.type] : null, dateOfBirth: formatIsoDate(p.dateOfBirth), tickets }];
    }),
    segments: t.segments.map((s, i) => {
      const segment = toCustomerSegment(s, i, t.segments[i - 1]);
      const travelClass = s.cabin && s.bookingClass ? `${s.cabin} (${s.bookingClass})` : (s.cabin ?? s.bookingClass);
      return {
        ...segment,
        from: { ...segment.from, terminal: s.departureTerminal },
        to: { ...segment.to, terminal: s.arrivalTerminal },
        details: [
          severalBookings && references[i] && `Booking ref: ${references[i]}`,
          travelClass && `Class: ${travelClass}`,
          s.bookingStatus && `Status: ${s.bookingStatus}`,
        ].filter((v): v is string => Boolean(v)),
      };
    }),
    fareConditions: t.fareConditions,
    notes: t.notes,
    terms: noteLines(t.infoText),
    termsDari: noteLines(t.infoTextDari),
  };
}
