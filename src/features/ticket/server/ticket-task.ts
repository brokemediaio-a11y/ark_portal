import "server-only";
import type { UncertainField as Flag } from "@/features/extraction/schema";
import { resolveAssumedYears } from "@/features/extraction/server/assumed-years";
import { orderFlightsBySource } from "@/features/extraction/server/flight-order";
import type { ExtractionTask } from "@/features/extraction/server/extract-service";
import { groundSegment, notPrinted } from "@/features/extraction/server/grounding";
import { sharedRules } from "@/features/extraction/server/prompt";
import { parsePersianDate } from "@/features/extraction/server/persian-date";
import { dateInSource, textInSource } from "@/features/extraction/server/source-match";
import { checkAgainstReads, checkItinerary, disagreement, mergeRepeatedFlights, withFlags } from "@/features/extraction/server/verification";
import { ticketExtractionSchema, type ExtractedTicketPassenger, type TicketExtraction } from "../extraction-schema";
import { DEMO_TICKET } from "./ticket-demo";

function buildTicketSystemPrompt(today: string): string {
  return `You extract airline e-ticket data for a travel agency, which reissues it on its own branded ticket. ${sharedRules(today)}

Ticket fields:
- passengers: one entry per traveller. A ticket file often has one page per passenger with the same flights: list every passenger once, and every flight once.
- name: exactly as printed, including the slash or order (e.g. "WROOR/MILA", "NOORI / FARHAD", "ERFANULLAH JAWED"). Leave out a date printed in brackets after the name, and titles like MR/MRS unless they are part of the printed name.
- dateOfBirth: only if printed (e.g. "(07FEB94)" or "23.12.1995"), as YYYY-MM-DD.
- type: only if printed (Adult, Child, Infant). Never work it out yourself.
- ticketNumber: exactly as printed for that passenger, digits and any dash. Never take it from another passenger.
- bookingReference: the booking reference / PNR / reservation code (e.g. "RESERVATION CODE", "PNR", "Booking ref").
- airlineReference: the airline's own reservation code when printed separately (e.g. "Airline Reservation Code SXHWN7"); otherwise null.
- issueDateAsPrinted: the ticket's issue date exactly as printed, whatever the calendar (e.g. "17 Sep 26", "1405/07/15").
- issueDate: the same date as YYYY-MM-DD only if it is printed in the Gregorian calendar; null for Persian (Solar Hijri) dates.
- issuedBy: the issuing airline or agency as printed.
- departureTerminal/arrivalTerminal: only if printed, without the word "Terminal".
- bookingClass: the reservation / booking class letter(s) as printed (e.g. "K", "Y1"); never the fare basis (e.g. "TVFRRTIN"). cabin: only a cabin name that is printed (e.g. "Economy"); never a class letter.
- airlineName: only a printed airline name; a carrier code like "RQ" goes in airlineCode, never in airlineName.
- bookingStatus: as printed (e.g. "OK", "CONFIRMED").
- handCarry and checkIn: the cabin and checked allowances as printed (e.g. "Baggage Allowance 30 kg, Cabin Baggage Allowance 5 kg" → checkIn "30 kg", handCarry "5 kg").
- fareConditions: refund or change conditions exactly as printed, or null.
- If the documents contain no ticket or flight information, set documentHasTicketDetails to false.`;
}

const nameKey = (name: string | null) => (name ?? "").toUpperCase().replace(/[^A-Z]/g, "");

/** A name counts as printed when every word of it is in the document, in any order ("MILA WROOR" ≈ "WROOR/MILA"). */
const nameInSource = (name: string, source: string) =>
  name.split(/[\s/,.-]+/).filter((word) => word.length > 1).every((word) => textInSource(word, source));

/** One traveller's values that the document doesn't print are removed and flagged. */
function groundPassenger(p: ExtractedTicketPassenger, i: number, source: string, flags: Flag[]): ExtractedTicketPassenger {
  const out = { ...p };
  const path = (key: string) => `passengers.${i}.${key}`;
  if (p.name && !nameInSource(p.name, source)) {
    out.name = null;
    flags.push(notPrinted(path("name"), p.name));
  }
  if (p.ticketNumber && !textInSource(p.ticketNumber, source)) {
    out.ticketNumber = null;
    flags.push(notPrinted(path("ticketNumber"), p.ticketNumber));
  }
  if (p.dateOfBirth && !dateInSource(p.dateOfBirth, source)) {
    out.dateOfBirth = null;
    flags.push(notPrinted(path("dateOfBirth"), p.dateOfBirth));
  }
  if (p.type && !textInSource(p.type, source)) out.type = null;
  return out;
}

/**
 * A Persian issue date ("1405/07/15") is converted here, not by the AI; a
 * Gregorian one must be printed. Anything else is dropped.
 */
function issueDateFrom(data: TicketExtraction, source: string, flags: Flag[]): string | null {
  const persian = parsePersianDate(data.issueDateAsPrinted);
  if (persian) {
    flags.push({ field: "issueDate", reason: `Printed in the Persian calendar as ${data.issueDateAsPrinted}; converted to ${persian}.`, evidence: data.issueDateAsPrinted });
    return persian;
  }
  return data.issueDate && dateInSource(data.issueDate, source) ? data.issueDate : null;
}

/** Everything in the ticket that the document doesn't print is removed; critical values are flagged. */
function groundTicket(data: TicketExtraction, source: string): TicketExtraction {
  const flags: Flag[] = [];
  const keep = (value: string | null) => (value && textInSource(value, source) ? value : null);
  const required = (field: string, value: string | null) => {
    if (!value || textInSource(value, source)) return value;
    flags.push(notPrinted(field, value));
    return null;
  };

  const segments = data.segments.map((segment, i) => {
    const grounded = groundSegment(segment, i, source, flags);
    return {
      ...grounded,
      // A class letter ("K") is not a cabin name.
      cabin: grounded.cabin && grounded.cabin === segment.bookingClass ? null : grounded.cabin,
      departureTerminal: keep(segment.departureTerminal),
      arrivalTerminal: keep(segment.arrivalTerminal),
      // A booking class is one or two characters ("K", "Y1"); anything longer is a fare basis.
      bookingClass: segment.bookingClass && segment.bookingClass.trim().length <= 2 ? keep(segment.bookingClass) : null,
      bookingStatus: keep(segment.bookingStatus),
    };
  });

  // One entry per traveller, even when every page of the file repeats them.
  const passengers = data.passengers
    .filter((p, i) => !data.passengers.slice(0, i).some((q) => nameKey(q.name) === nameKey(p.name) && q.ticketNumber === p.ticketNumber))
    .map((p, i) => groundPassenger(p, i, source, flags));

  return {
    ...data,
    segments,
    passengers,
    bookingReference: required("bookingReference", data.bookingReference),
    airlineReference: required("airlineReference", data.airlineReference),
    issueDate: issueDateFrom(data, source, flags),
    issuedBy: keep(data.issuedBy),
    fareConditions: data.fareConditions,
    // The issue date is decided in code (issueDateFrom), so the AI's own note on it is dropped.
    uncertainFields: [...data.uncertainFields.filter((f) => f.field !== "issueDate"), ...flags],
  };
}

/** On scans, flags a ticket number or booking reference that either reading doesn't show. */
function checkTicketAgainstReads(data: TicketExtraction, reads: readonly string[]): TicketExtraction {
  const flags: Flag[] = [];
  const check = (field: string, value: string | null) => {
    if (value && !reads.every((read) => textInSource(value, read))) flags.push(disagreement(field, value));
  };
  check("bookingReference", data.bookingReference);
  data.passengers.forEach((p, i) => check(`passengers.${i}.ticketNumber`, p.ticketNumber));
  return withFlags(checkAgainstReads(data, reads), flags);
}

/**
 * Supplier e-ticket (any format) → standard ticket data. After the AI answers:
 * merge repeated flights, remove what isn't printed, check scans against both
 * readings, resolve missing years, then flag impossible itineraries.
 */
export const ticketTask: ExtractionTask<TicketExtraction> = {
  name: "flight_ticket",
  schema: ticketExtractionSchema,
  systemPrompt: buildTicketSystemPrompt,
  userInstruction: "Extract the e-ticket from the supplier documents below.",
  demo: DEMO_TICKET,
  found: (data) => data.documentHasTicketDetails && data.segments.length > 0,
  notFoundMessage: "We couldn't find a ticket or any flights in these documents. Are they the right files?",
  verify(raw, documents, today) {
    let data = groundTicket(mergeRepeatedFlights(raw), documents.source);
    if (documents.reads) data = checkTicketAgainstReads(data, documents.reads);
    return withFlags(checkItinerary(orderFlightsBySource(resolveAssumedYears(data, today, documents.source), documents.source)), []);
  },
};
