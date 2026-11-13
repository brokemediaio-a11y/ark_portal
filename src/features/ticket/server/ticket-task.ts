import "server-only";
import type { UncertainField as Flag } from "@/features/extraction/schema";
import { resolveAssumedYears } from "@/features/extraction/server/assumed-years";
import { orderFlightsAcrossDocuments, orderFlightsBySource } from "@/features/extraction/server/flight-order";
import type { ExtractionTask } from "@/features/extraction/server/extract-service";
import { groundSegment, notPrinted } from "@/features/extraction/server/grounding";
import { sharedRules } from "@/features/extraction/server/prompt";
import { parsePersianDate } from "@/features/extraction/server/persian-date";
import { dateInSource, flightNumberInSource, textInSource } from "@/features/extraction/server/source-match";
import { checkAgainstReads, checkItinerary, disagreement, dropFlagsOnEmptyValues, mergeRepeatedFlights, withFlags } from "@/features/extraction/server/verification";
import { ticketExtractionSchema, type ExtractedTicket, type ExtractedTicketPassenger, type TicketExtraction } from "../extraction-schema";
import { DEMO_TICKET } from "./ticket-demo";

function buildTicketSystemPrompt(today: string): string {
  return `You extract airline e-ticket data for a travel agency, which reissues it on its own branded ticket. ${sharedRules(today)}

Ticket fields:
- passengers: one entry per traveller. A ticket file often has one page per passenger with the same flights: list every passenger once, and every flight once.
- name: exactly as printed, including the slash or order (e.g. "WROOR/MILA", "NOORI / FARHAD", "ERFANULLAH JAWED"). Leave out a date printed in brackets after the name, and titles like MR/MRS unless they are part of the printed name.
- dateOfBirth: only if printed (e.g. "(07FEB94)" or "23.12.1995"), as YYYY-MM-DD.
- type: only if printed (Adult, Child, Infant). Never work it out yourself.
- tickets: every e-ticket number printed for that passenger, exactly as printed (digits and any dash), each with flightNumbers: the flights that ticket covers. A passenger booked through several suppliers has one ticket per supplier document: list each, with its own flights. Never take a ticket number from another passenger.
- segments[].bookingReference: the booking reference / PNR printed for that flight's booking (e.g. "PNR : PTX09", "Airline Booking Reference TIKVND"). Flights in different documents usually have different references. Prefer the airline's booking reference over an agency's long order number.
- bookingReference: the booking reference of the first flight.
- airlineReference: the airline's own reservation code when printed separately (e.g. "Airline Reservation Code SXHWN7"); otherwise null.
- issueDateAsPrinted: the ticket's issue date exactly as printed, whatever the calendar (e.g. "17 Sep 26", "1405/07/15").
- issueDate: the same date as YYYY-MM-DD only if it is printed in the Gregorian calendar; null for Persian (Solar Hijri) dates.
- issuedBy: the issuing airline or agency as printed.
- departureTerminal/arrivalTerminal: only if printed, without the word "Terminal".
- bookingClass: the reservation / booking class letter(s) as printed (e.g. "K", "Y1"); never the fare basis (e.g. "TVFRRTIN"). cabin: only a cabin name that is printed (e.g. "Economy"); never a class letter.
- airlineName: only a printed airline name; a carrier code like "RQ" goes in airlineCode, never in airlineName. A travel agency, booking website or ticket provider (e.g. "OrientTrips", "Trip.com") is never the airline: if no airline is named for a flight, airlineName is null.
- bookingStatus: as printed (e.g. "OK", "CONFIRMED").
- handCarry and checkIn: the cabin and checked allowances as printed (e.g. "Baggage Allowance 30 kg, Cabin Baggage Allowance 5 kg" → checkIn "30 kg", handCarry "5 kg").
- fareConditions: refund or change conditions exactly as printed, or null.
- If the documents contain no ticket or flight information, set documentHasTicketDetails to false.`;
}

const nameKey = (name: string | null) => (name ?? "").toUpperCase().replace(/[^A-Z]/g, "");
const digitsOnly = (value: string) => value.replace(/\D/g, "");
/** "TK 1800", "tk1800" and "TK1800" are the same flight. */
const flightKey = (value: string | null) => (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** An airline e-ticket number: 13 digits, often printed as 3-10 ("235-2531625879"). */
const E_TICKET_NUMBER = /(?<!\d)\d{3}[\s-]?\d{10}(?!\d)/g;

const ticketNumbersOf = (data: TicketExtraction) => data.passengers.flatMap((p) => p.tickets.flatMap((t) => (t.ticketNumber ? [t.ticketNumber] : [])));

/** A file printing an e-ticket number that no passenger has was (at least partly) left out. */
function missesTicketNumber(data: TicketExtraction, text: string): boolean {
  const known = new Set(ticketNumbersOf(data).map(digitsOnly));
  return [...text.matchAll(E_TICKET_NUMBER)].some((m) => !known.has(digitsOnly(m[0])));
}

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
  out.tickets = p.tickets.flatMap((t, j) => {
    if (!t.ticketNumber) return [];
    if (textInSource(t.ticketNumber, source)) return [t];
    flags.push(notPrinted(path(`tickets.${j}.ticketNumber`), t.ticketNumber));
    return [];
  });
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
      bookingReference: required(`segments.${i}.bookingReference`, segment.bookingReference),
    };
  });

  // One entry per traveller, even when every page of the file repeats them.
  const ticketsKey = (p: ExtractedTicketPassenger) => p.tickets.map((t) => digitsOnly(t.ticketNumber ?? "")).sort().join(",");
  const passengers = data.passengers
    .filter((p, i) => !data.passengers.slice(0, i).some((q) => nameKey(q.name) === nameKey(p.name) && ticketsKey(q) === ticketsKey(p)))
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

/** "PNR : PTX09", "Booking reference: ABC123", "Reservation code XYZ789": a short code with at least one letter. */
const REFERENCE_LABEL = /\b(?:PNR|booking\s+ref(?:erence)?|booking\s+code|reservation\s+(?:code|number)|record\s+locator)\s*[:#|]?\s*([A-Z0-9]{5,8})(?![A-Za-z0-9])/gi;

/** The one booking reference a file prints next to a label, or null when it prints none or several. */
export function labelledReference(text: string): string | null {
  const codes = new Set([...text.matchAll(REFERENCE_LABEL)].map((m) => m[1].toUpperCase()).filter((code) => /[A-Z]/.test(code)));
  return codes.size === 1 ? [...codes][0] : null;
}

/**
 * Several files: which file each flight, booking reference and ticket number is printed in decides what belongs
 * together, rather than the AI's pairing. A flight takes a booking reference printed in its own file; a ticket number
 * covers the flights of the file it is printed in. One file (or a value printed in several) keeps the AI's pairing.
 */
export function pairByDocument(data: TicketExtraction, documents: readonly string[]): TicketExtraction {
  if (documents.length < 2) return data;
  // Read once per file: a flight with no reference takes the one its file prints next to a label, if there is just one.
  const labelled = documents.map(labelledReference);
  const documentOf = (flightNumber: string | null) => (flightNumber ? documents.findIndex((d) => flightNumberInSource(flightNumber, d)) : -1);
  const flightDocuments = data.segments.map((s) => documentOf(s.flightNumber));
  const printedIn = (value: string) => documents.flatMap((d, i) => (textInSource(value, d) ? [i] : []));

  const segments = data.segments.map((s, i) => {
    const at = flightDocuments[i];
    if (at < 0) return s;
    const own = s.bookingReference && printedIn(s.bookingReference).includes(at) ? s.bookingReference : null;
    // The job's main reference when it is printed in this flight's file.
    const fallback = data.bookingReference && printedIn(data.bookingReference).includes(at) ? data.bookingReference : null;
    return { ...s, bookingReference: own ?? fallback ?? labelled[at] };
  });

  const passengers = data.passengers.map((p) => ({
    ...p,
    tickets: p.tickets.map((t) => {
      const where = t.ticketNumber ? printedIn(t.ticketNumber) : [];
      if (where.length !== 1) return t;
      // Another of this traveller's tickets in the same file: the file alone can't say which flight is whose.
      const shared = p.tickets.some((other) => other !== t && other.ticketNumber && printedIn(other.ticketNumber).includes(where[0]));
      if (shared) return t;
      const flights = data.segments.flatMap((s, i) => (flightDocuments[i] === where[0] && s.flightNumber ? [s.flightNumber] : []));
      return flights.length ? { ...t, flightNumbers: flights } : t;
    }),
  }));
  return { ...data, segments, passengers };
}

/** Words that label or address a name rather than belong to it ("KAZEM (First name)", "Samadi / Kazem MR"). */
const NOT_NAME_WORDS = new Set(["MR", "MRS", "MS", "MISS", "MSTR", "MASTER", "DR", "FIRST", "LAST", "GIVEN", "FAMILY", "SURNAME", "NAME"]);

/** The same traveller however a supplier prints the name: "Samadi / Kazem MR" and "KAZEM SAMADI" give the same key. */
export function travellerKey(name: string | null): string | null {
  const words = (name ?? "").toUpperCase().split(/[^\p{L}]+/u).filter((word) => word && !NOT_NAME_WORDS.has(word));
  return words.length ? [...words].sort().join(" ") : null;
}

/** One ticket per number: a number listed twice keeps every flight either listing gave it. */
function uniqueTickets(tickets: ExtractedTicket[]): ExtractedTicket[] {
  const out: ExtractedTicket[] = [];
  for (const t of tickets) {
    const same = out.find((o) => o.ticketNumber && t.ticketNumber && digitsOnly(o.ticketNumber) === digitsOnly(t.ticketNumber));
    if (!same) out.push({ ...t, flightNumbers: [...t.flightNumbers] });
    else if (same.flightNumbers.length && t.flightNumbers.length)
      same.flightNumbers = [...same.flightNumbers, ...t.flightNumbers.filter((f) => !same.flightNumbers.some((g) => flightKey(g) === flightKey(f)))];
    // A listing with no flights covers every flight, so the merged ticket does too.
    else same.flightNumbers = [];
  }
  return out;
}

/**
 * A trip booked through several suppliers gives one traveller a ticket per supplier. They are shown once, with all of
 * their e-tickets. Entries with a different date of birth or type are different people and stay apart.
 */
export function mergeTravellers(data: TicketExtraction): TicketExtraction {
  const groups: { key: string | null; members: number[] }[] = [];
  data.passengers.forEach((p, i) => {
    const key = travellerKey(p.name);
    const group = key && groups.find((g) => g.key === key && g.members.every((m) => {
      const other = data.passengers[m];
      return (!p.dateOfBirth || !other.dateOfBirth || p.dateOfBirth === other.dateOfBirth) && (!p.type || !other.type || p.type === other.type);
    }));
    if (group) group.members.push(i);
    else groups.push({ key, members: [i] });
  });
  if (groups.length === data.passengers.length) return data;

  const passengers = groups.map(({ members }) => {
    const all = members.map((m) => data.passengers[m]);
    return {
      name: all[0].name,
      type: all.find((p) => p.type)?.type ?? null,
      dateOfBirth: all.find((p) => p.dateOfBirth)?.dateOfBirth ?? null,
      tickets: uniqueTickets(all.flatMap((p) => p.tickets)),
    };
  });
  const uncertainFields = data.uncertainFields.map((flag) => {
    const m = /^passengers\.(\d+)\.(.+)$/.exec(flag.field);
    const index = m ? groups.findIndex((g) => g.members.includes(Number(m[1]))) : -1;
    // Ticket positions change when travellers merge, so a ticket flag points at the traveller.
    const rest = m && /^tickets\./.test(m[2]) ? "tickets" : m?.[2];
    return m && index >= 0 ? { ...flag, field: `passengers.${index}.${rest}` } : flag;
  });
  return withFlags({ ...data, passengers, uncertainFields: [] }, uncertainFields);
}

/** On scans, flags a ticket number or booking reference that either reading doesn't show. */
function checkTicketAgainstReads(data: TicketExtraction, reads: readonly string[]): TicketExtraction {
  const flags: Flag[] = [];
  const check = (field: string, value: string | null) => {
    if (value && !reads.every((read) => textInSource(value, read))) flags.push(disagreement(field, value));
  };
  check("bookingReference", data.bookingReference);
  data.segments.forEach((s, i) => check(`segments.${i}.bookingReference`, s.bookingReference));
  data.passengers.forEach((p, i) => p.tickets.forEach((t, j) => check(`passengers.${i}.tickets.${j}.ticketNumber`, t.ticketNumber)));
  return withFlags(checkAgainstReads(data, reads), flags);
}

/** A file read again on its own adds its travellers' tickets, and its booking reference to its own flights. */
function mergeDocument(data: TicketExtraction, extra: TicketExtraction): TicketExtraction {
  const known = new Set(ticketNumbersOf(data).map(digitsOnly));
  return {
    ...data,
    documentHasTicketDetails: data.documentHasTicketDetails || extra.documentHasTicketDetails,
    bookingReference: data.bookingReference ?? extra.bookingReference,
    segments: data.segments.map((s) => {
      if (s.bookingReference) return s;
      const same = extra.segments.find((e) => e.flightNumber && flightKey(e.flightNumber) === flightKey(s.flightNumber));
      return same ? { ...s, bookingReference: same.bookingReference ?? extra.bookingReference } : s;
    }),
    passengers: [
      ...data.passengers,
      ...extra.passengers
        .map((p) => ({ ...p, tickets: p.tickets.filter((t) => t.ticketNumber && !known.has(digitsOnly(t.ticketNumber))) }))
        .filter((p) => p.tickets.length > 0),
    ],
  };
}

/**
 * Supplier e-ticket (any format) → standard ticket data. After the AI answers:
 * merge repeated flights, remove what isn't printed, check scans against both
 * readings, pair references and tickets with their flights by file, show each
 * traveller once, resolve missing years, then flag impossible itineraries.
 */
export const ticketTask: ExtractionTask<TicketExtraction> = {
  name: "flight_ticket",
  schema: ticketExtractionSchema,
  systemPrompt: buildTicketSystemPrompt,
  userInstruction: "Extract the e-ticket from the supplier documents below.",
  demo: DEMO_TICKET,
  found: (data) => data.documentHasTicketDetails && data.segments.length > 0,
  missesFromDocument: missesTicketNumber,
  mergeDocument,
  notFoundMessage: "We couldn't find a ticket or any flights in these documents. Are they the right files?",
  verify(raw, documents, today) {
    let data = groundTicket(mergeRepeatedFlights(dropFlagsOnEmptyValues(raw)), documents.source);
    if (documents.reads) data = checkTicketAgainstReads(data, documents.reads);
    data = mergeTravellers(pairByDocument(data, documents.documents));
    return withFlags(checkItinerary(orderFlightsAcrossDocuments(orderFlightsBySource(resolveAssumedYears(data, today, documents.source), documents.source), documents.source)), []);
  },
};
