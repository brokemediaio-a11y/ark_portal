import "server-only";
import type { Extraction, ExtractedSegment } from "../schema";
import {
  amountInSource,
  currencyInSource,
  dateInSource,
  durationInSource,
  flightNumberInSource,
  mentionsStops,
  mentionsTravellers,
  textInSource,
  timeInSource,
} from "./source-match";

type Flag = Extraction["uncertainFields"][number];

const notPrinted = (field: string, value: string): Flag => ({
  field,
  reason: `The AI returned "${value}", but this isn't printed in the document, so it was removed. Please check the original.`,
  evidence: value,
});

/** Removes everything from one flight that the document doesn't print, flagging what staff must check. */
function groundSegment(segment: ExtractedSegment, index: number, source: string, flags: Flag[]): ExtractedSegment {
  const path = (key: string) => `segments.${index}.${key}`;
  const out = { ...segment };

  // Critical values: a wrong one is worse than an empty one.
  const required = (key: "flightNumber" | "originCode" | "destinationCode" | "departureTime" | "arrivalTime", found: (value: string, text: string) => boolean) => {
    const value = segment[key];
    if (value && !found(value, source)) {
      out[key] = null;
      flags.push(notPrinted(path(key), value));
    }
  };
  required("flightNumber", flightNumberInSource);
  required("originCode", textInSource);
  required("destinationCode", textInSource);
  required("departureTime", timeInSource);
  required("arrivalTime", timeInSource);

  // Dates can legitimately be implied ("+1"), so they are flagged rather than removed.
  for (const key of ["departureDate", "arrivalDate"] as const) {
    const value = segment[key];
    if (value && !dateInSource(value, source))
      flags.push({ field: path(key), reason: `"${value}" isn't printed like this in the document. Please check it.`, evidence: value });
  }

  // Descriptive values: drop quietly, staff can fill them in.
  for (const key of ["airlineName", "originName", "destinationName", "cabin", "baggage"] as const) {
    const value = segment[key];
    if (value && !textInSource(value, source)) out[key] = null;
  }
  if (segment.duration && !durationInSource(segment.duration, source)) out.duration = null;
  if (segment.stops !== null && !mentionsStops(source)) out.stops = null;

  return out;
}

/**
 * Deterministic "copy only what is printed" check against the document's text
 * (the PDF text layer, or the transcript of a scan). Models expand codes into
 * names and, on hard documents, invent whole values; anything not in the source
 * is removed so staff fill it in instead of trusting a guess.
 */
export function groundInSourceText(data: Extraction, source: string): Extraction {
  const flags: Flag[] = [];
  const keepText = (value: string | null) => (value && textInSource(value, source) ? value : null);
  const keepAmount = (field: string, value: number | null) => {
    if (value === null || amountInSource(value, source)) return value;
    flags.push(notPrinted(field, String(value)));
    return null;
  };

  return {
    ...data,
    segments: data.segments.map((segment, i) => groundSegment(segment, i, source, flags)),
    passengers: mentionsTravellers(source) ? data.passengers : { adults: null, children: null, infants: null },
    currency: data.currency && currencyInSource(data.currency, source) ? data.currency : null,
    baseAmount: keepAmount("baseAmount", data.baseAmount),
    taxAmount: keepAmount("taxAmount", data.taxAmount),
    totalAmount: keepAmount("sourceTotal", data.totalAmount),
    fareConditions: keepText(data.fareConditions),
    sourceReference: keepText(data.sourceReference),
    customerName: keepText(data.customerName),
    uncertainFields: [...data.uncertainFields, ...flags],
  };
}
