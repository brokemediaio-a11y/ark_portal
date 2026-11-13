import { brand } from "@/config/brand";
import { clean, createEmptySegment, newId, normalizeFormatted, segmentFromExtraction } from "@/features/quotation/factory";
import { ISO_DATE, type ReviewFlag } from "@/features/quotation/schema";
import type { ExtractedTicketPassenger, TicketExtraction } from "./extraction-schema";
import type { PassengerType, Ticket, TicketPassenger, TicketSegment } from "./schema";

/** e.g. ARK-T-261108-4F7A: date + random suffix, like quotation numbers. */
export function generateTicketRef(now = new Date()): string {
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${brand.ticketNumberPrefix}-${yy}${mm}${dd}-${newId().replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

export const createEmptyTicketSegment = (): TicketSegment => ({
  ...createEmptySegment(),
  departureTerminal: null,
  arrivalTerminal: null,
  bookingClass: null,
  bookingStatus: null,
  bookingReference: null,
});

export const createEmptyPassenger = (): TicketPassenger => ({ id: newId(), name: null, type: null, dateOfBirth: null, ticketNumber: null, flightTicketNumbers: {} });

export function createEmptyTicket(sourceType: Ticket["sourceType"] = "manual"): Ticket {
  const now = new Date().toISOString();
  return {
    id: newId(),
    ticketRef: generateTicketRef(),
    status: "draft",
    sourceType,
    sourceFileNames: [],
    bookingReference: null,
    airlineReference: null,
    issueDate: null,
    issuedBy: brand.legalName,
    passengers: [createEmptyPassenger()],
    segments: [createEmptyTicketSegment()],
    fareConditions: null,
    notes: null,
    infoText: brand.ticketNotes,
    infoTextDari: brand.ticketNotesDari,
    reviewFlags: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Age in whole years on a given date (both YYYY-MM-DD). */
function ageOn(dateOfBirth: string, on: string): number {
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [y, m, d] = on.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/**
 * The printed type when there is one; otherwise worked out from the date of birth
 * on the first flight, using the usual airline age bands (under 2, 2–11, 12+).
 */
function passengerType(printed: string | null, dateOfBirth: string | null, firstFlight: string | null): PassengerType {
  const value = printed?.toLowerCase() ?? "";
  if (/inf/.test(value)) return "infant";
  if (/ch|cnn/.test(value)) return "child";
  if (/ad/.test(value)) return "adult";
  if (!dateOfBirth || !firstFlight) return null;
  const age = ageOn(dateOfBirth, firstFlight);
  return age < 0 ? null : age < 2 ? "infant" : age < 12 ? "child" : "adult";
}

const flightKey = (value: string | null) => (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** The value used on the most flights (the first one on a tie), or null. */
function mostUsed(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  for (const [v, n] of counts) if (best === null || n > counts.get(best)!) best = v;
  return best;
}

/**
 * Each flight's e-ticket number for one traveller: the ticket that lists the flight, else one that covers every
 * flight. The number used most becomes the traveller's main number; the others are kept per flight.
 */
function ticketNumbersFor(p: ExtractedTicketPassenger, segments: TicketSegment[]): Pick<TicketPassenger, "ticketNumber" | "flightTicketNumbers"> {
  const tickets = p.tickets.flatMap((t) => (clean(t.ticketNumber) ? [{ number: clean(t.ticketNumber)!, flights: t.flightNumbers.map(flightKey) }] : []));
  const perFlight = segments.map((s) =>
    (tickets.find((t) => t.flights.includes(flightKey(s.flightNumber))) ?? tickets.find((t) => t.flights.length === 0))?.number ?? null);
  const main = mostUsed(perFlight) ?? tickets[0]?.number ?? null;
  const flightTicketNumbers: Record<string, string> = {};
  segments.forEach((s, i) => {
    if (perFlight[i] && perFlight[i] !== main) flightTicketNumbers[s.id] = perFlight[i]!;
  });
  return { ticketNumber: main, flightTicketNumbers };
}

function passengerFromExtraction(p: ExtractedTicketPassenger, index: number, segments: TicketSegment[], flags: ReviewFlag[]): TicketPassenger {
  const dateOfBirth = normalizeFormatted(p.dateOfBirth, ISO_DATE, `passengers.${index}.dateOfBirth`, flags);
  return {
    id: newId(),
    name: clean(p.name),
    type: passengerType(clean(p.type), dateOfBirth, segments[0]?.departureDate ?? null),
    dateOfBirth,
    ...ticketNumbersFor(p, segments),
  };
}

/** A flag on one of a traveller's tickets is shown on the traveller's e-ticket number. */
const formField = (field: string) => field.replace(/^passengers\.(\d+)\.tickets(?:\..*)?$/, "passengers.$1.ticketNumber");

export function ticketFromExtraction(extraction: TicketExtraction, meta: { fileNames: string[]; demo: boolean }): Ticket {
  const base = createEmptyTicket(meta.demo ? "demo" : "upload");
  const flags: ReviewFlag[] = extraction.uncertainFields.map((u) => ({ field: formField(u.field), reason: u.reason, evidence: clean(u.evidence) }));

  const segments: TicketSegment[] = extraction.segments.map((s, i) => ({
    ...segmentFromExtraction(s, i, flags),
    departureTerminal: clean(s.departureTerminal),
    arrivalTerminal: clean(s.arrivalTerminal),
    bookingClass: clean(s.bookingClass),
    bookingStatus: clean(s.bookingStatus),
    bookingReference: clean(s.bookingReference),
  }));
  const passengers = extraction.passengers.map((p, i) => passengerFromExtraction(p, i, segments, flags));
  // The reference most flights use is the ticket's; a flight keeps its own only when it differs.
  const bookingReference = mostUsed(segments.map((s) => s.bookingReference)) ?? clean(extraction.bookingReference);

  return {
    ...base,
    sourceFileNames: meta.fileNames,
    bookingReference,
    airlineReference: clean(extraction.airlineReference),
    issueDate: normalizeFormatted(extraction.issueDate, ISO_DATE, "issueDate", flags),
    passengers: passengers.length ? passengers : base.passengers,
    segments: segments.length ? segments.map((s) => (s.bookingReference === bookingReference ? { ...s, bookingReference: null } : s)) : base.segments,
    fareConditions: clean(extraction.fareConditions),
    reviewFlags: flags,
  };
}
