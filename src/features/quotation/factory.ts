import { brand } from "@/config/brand";
import type { Extraction, ExtractedSegment } from "@/features/extraction/schema";
import { checkInLabel, conditionsLabel, handCarryLabel, flightNumberLabel, formatDuration, splitLocal } from "@/features/flights/format";
import type { FlightOffer, OfferSegment } from "@/features/flights/schema";
import {
  AIRLINE_CODE,
  CURRENCY_CODE,
  IATA_CODE,
  ISO_DATE,
  TIME_24H,
  type FlightSegment,
  type Passengers,
  type Quotation,
  type ReviewFlag,
  type SourceType,
} from "./schema";

export const newId = () => crypto.randomUUID();

/** e.g. ARK-251025-4F7A — date + random suffix. Format to be confirmed by Ark Travelers. */
export function generateQuoteNumber(now = new Date()): string {
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const suffix = newId().replace(/-/g, "").slice(0, 4).toUpperCase();
  return `${brand.quoteNumberPrefix}-${yy}${mm}${dd}-${suffix}`;
}

export function createEmptySegment(): FlightSegment {
  return {
    id: newId(),
    airlineName: null,
    airlineCode: null,
    flightNumber: null,
    originCode: null,
    originName: null,
    destinationCode: null,
    destinationName: null,
    departureDate: null,
    departureTime: null,
    arrivalDate: null,
    arrivalTime: null,
    duration: null,
    stops: null,
    cabin: null,
    handCarry: null,
    checkIn: null,
  };
}

export function createEmptyQuotation(sourceType: SourceType = "manual"): Quotation {
  const now = new Date().toISOString();
  return {
    id: newId(),
    quoteNumber: generateQuoteNumber(),
    status: "draft",
    sourceType,
    sourceReference: null,
    sourceProvider: null,
    providerSnapshot: null,
    sourceFileName: null,
    customer: { name: null, email: null, phone: null },
    passengers: { adults: 1, children: null, infants: null },
    segments: [createEmptySegment()],
    currency: null,
    baseAmount: null,
    taxAmount: null,
    sourceTotal: null,
    markup: { type: "fixed", value: 0 },
    fareConditions: null,
    notes: null,
    termsText: brand.defaultTerms,
    termsTextDari: brand.defaultTermsDari,
    reviewFlags: [],
    createdAt: now,
    updatedAt: now,
  };
}

/* ---------- Mapping AI output → quotation (defensive: AI output is untrusted) ---------- */

export const clean = (v: string | null | undefined) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Keep a value only if it matches the expected format; otherwise drop it and
 * raise a review flag so staff see the original text instead of a silent guess.
 */
export function normalizeFormatted(
  raw: string | null,
  pattern: RegExp,
  field: string,
  flags: ReviewFlag[],
  transform: (v: string) => string = (v) => v,
): string | null {
  const value = clean(raw);
  if (!value) return null;
  const normalized = transform(value);
  if (pattern.test(normalized)) return normalized;
  flags.push({ field, reason: `Could not read "${value}" in the expected format.`, evidence: value });
  return null;
}

export const upper = (v: string) => v.toUpperCase().replace(/\s+/g, "");
const padTime = (v: string) => v.replace(/^(\d):/, "0$1:");

/** One extracted flight → editable flight. Badly formatted values are dropped and flagged. */
export function segmentFromExtraction(s: ExtractedSegment, index: number, flags: ReviewFlag[]): FlightSegment {
  const f = (key: string) => `segments.${index}.${key}`;
  return {
    id: newId(),
    airlineName: clean(s.airlineName),
    airlineCode: normalizeFormatted(s.airlineCode, AIRLINE_CODE, f("airlineCode"), flags, upper),
    flightNumber: clean(s.flightNumber),
    originCode: normalizeFormatted(s.originCode, IATA_CODE, f("originCode"), flags, upper),
    originName: clean(s.originName),
    destinationCode: normalizeFormatted(s.destinationCode, IATA_CODE, f("destinationCode"), flags, upper),
    destinationName: clean(s.destinationName),
    departureDate: normalizeFormatted(s.departureDate, ISO_DATE, f("departureDate"), flags),
    departureTime: normalizeFormatted(s.departureTime, TIME_24H, f("departureTime"), flags, padTime),
    arrivalDate: normalizeFormatted(s.arrivalDate, ISO_DATE, f("arrivalDate"), flags),
    arrivalTime: normalizeFormatted(s.arrivalTime, TIME_24H, f("arrivalTime"), flags, padTime),
    duration: clean(s.duration),
    stops: toCount(s.stops),
    cabin: clean(s.cabin),
    handCarry: clean(s.handCarry),
    checkIn: clean(s.checkIn),
  };
}

const nonNegative = (n: number | null) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null);
function toCount(n: number | null): number | null {
  const v = nonNegative(n);
  return v === null ? null : Math.floor(v);
}

export function quotationFromExtraction(
  extraction: Extraction,
  meta: { fileName: string | null; demo: boolean },
): Quotation {
  const base = createEmptyQuotation(meta.demo ? "demo" : "upload");
  const flags: ReviewFlag[] = extraction.uncertainFields.map((u) => ({
    field: u.field,
    reason: u.reason,
    evidence: clean(u.evidence),
  }));
  const segments = extraction.segments.map((s, i) => segmentFromExtraction(s, i, flags));

  return {
    ...base,
    sourceFileName: meta.fileName,
    sourceReference: clean(extraction.sourceReference),
    customer: { ...base.customer, name: clean(extraction.customerName) },
    passengers: {
      adults: toCount(extraction.passengers.adults) ?? base.passengers.adults,
      children: toCount(extraction.passengers.children),
      infants: toCount(extraction.passengers.infants),
    },
    segments: segments.length ? segments : base.segments,
    currency: normalizeFormatted(extraction.currency, CURRENCY_CODE, "currency", flags, upper),
    baseAmount: nonNegative(extraction.baseAmount),
    taxAmount: nonNegative(extraction.taxAmount),
    sourceTotal: nonNegative(extraction.totalAmount),
    fareConditions: clean(extraction.fareConditions),
    reviewFlags: flags,
  };
}

/* ---------- Flight provider offer → quotation ---------- */

function segmentFromOffer(seg: OfferSegment): FlightSegment {
  const dep = splitLocal(seg.departingAt);
  const arr = splitLocal(seg.arrivingAt);
  return {
    ...createEmptySegment(),
    airlineName: seg.marketing.name,
    airlineCode: seg.marketing.iata,
    flightNumber: flightNumberLabel(seg.marketing.iata, seg.marketing.flightNumber),
    originCode: seg.origin.iata,
    originName: seg.origin.cityName ?? seg.origin.name,
    destinationCode: seg.destination.iata,
    destinationName: seg.destination.cityName ?? seg.destination.name,
    departureDate: dep.date,
    departureTime: dep.time,
    arrivalDate: arr.date,
    arrivalTime: arr.time,
    duration: formatDuration(seg.durationMinutes),
    stops: seg.technicalStops,
    cabin: seg.cabin,
    handCarry: handCarryLabel(seg.baggage),
    checkIn: checkInLabel(seg.baggage),
  };
}

/** "Flight EY 78 is operated by Air Serbia." for codeshares — customer-relevant, so it goes in the notes. */
function operatedByNotes(offer: FlightOffer): string | null {
  const notes = offer.slices.flatMap((slice) =>
    slice.segments.flatMap((seg) =>
      seg.operating.name && seg.operating.iata !== seg.marketing.iata
        ? [`Flight ${flightNumberLabel(seg.marketing.iata, seg.marketing.flightNumber)} is operated by ${seg.operating.name}.`]
        : [],
    ),
  );
  return notes.length ? notes.join("\n") : null;
}

/**
 * Builds a quotation from a freshly re-priced provider offer. The provider price
 * becomes the supplier total; staff add their markup in the editor as usual.
 */
export function quotationFromFlightOffer(
  offer: FlightOffer,
  meta: { providerLabel: string; passengers: Passengers; refreshedAt: string },
): Quotation {
  return {
    ...createEmptyQuotation("flight_search"),
    sourceProvider: meta.providerLabel,
    sourceReference: offer.owner.name ? `${offer.owner.name} fare` : null,
    providerSnapshot: {
      provider: offer.provider,
      offerRequestId: offer.offerRequestId,
      offerId: offer.id,
      liveMode: offer.liveMode,
      totalAmount: offer.totalAmount,
      totalCurrency: offer.totalCurrency,
      expiresAt: offer.expiresAt,
      refreshedAt: meta.refreshedAt,
    },
    passengers: meta.passengers,
    segments: offer.slices.flatMap((slice) => slice.segments.map(segmentFromOffer)),
    currency: offer.totalCurrency,
    sourceTotal: offer.totalAmount,
    baseAmount: offer.baseAmount,
    taxAmount: offer.taxAmount,
    fareConditions: conditionsLabel(offer.conditions),
    notes: operatedByNotes(offer),
  };
}
