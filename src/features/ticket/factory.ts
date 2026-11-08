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
});

export const createEmptyPassenger = (): TicketPassenger => ({ id: newId(), name: null, type: null, dateOfBirth: null, ticketNumber: null });

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
    issuedBy: null,
    passengers: [createEmptyPassenger()],
    segments: [createEmptyTicketSegment()],
    fareConditions: null,
    notes: null,
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

function passengerFromExtraction(p: ExtractedTicketPassenger, index: number, firstFlight: string | null, flags: ReviewFlag[]): TicketPassenger {
  const dateOfBirth = normalizeFormatted(p.dateOfBirth, ISO_DATE, `passengers.${index}.dateOfBirth`, flags);
  return {
    id: newId(),
    name: clean(p.name),
    type: passengerType(clean(p.type), dateOfBirth, firstFlight),
    dateOfBirth,
    ticketNumber: clean(p.ticketNumber),
  };
}

export function ticketFromExtraction(extraction: TicketExtraction, meta: { fileNames: string[]; demo: boolean }): Ticket {
  const base = createEmptyTicket(meta.demo ? "demo" : "upload");
  const flags: ReviewFlag[] = extraction.uncertainFields.map((u) => ({ field: u.field, reason: u.reason, evidence: clean(u.evidence) }));

  const segments: TicketSegment[] = extraction.segments.map((s, i) => ({
    ...segmentFromExtraction(s, i, flags),
    departureTerminal: clean(s.departureTerminal),
    arrivalTerminal: clean(s.arrivalTerminal),
    bookingClass: clean(s.bookingClass),
    bookingStatus: clean(s.bookingStatus),
  }));
  const firstFlight = segments[0]?.departureDate ?? null;
  const passengers = extraction.passengers.map((p, i) => passengerFromExtraction(p, i, firstFlight, flags));

  return {
    ...base,
    sourceFileNames: meta.fileNames,
    bookingReference: clean(extraction.bookingReference),
    airlineReference: clean(extraction.airlineReference),
    issueDate: normalizeFormatted(extraction.issueDate, ISO_DATE, "issueDate", flags),
    issuedBy: clean(extraction.issuedBy),
    passengers: passengers.length ? passengers : base.passengers,
    segments: segments.length ? segments : base.segments,
    fareConditions: clean(extraction.fareConditions),
    reviewFlags: flags,
  };
}
