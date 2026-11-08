import "server-only";
import type { Extraction, ExtractedSegment, UncertainField as Flag } from "../schema";
import {
  amountInSource,
  codeInSource,
  currencyInSource,
  dateInSource,
  durationInSource,
  flightNumberInSource,
  mentionsStops,
  mentionsTravellers,
  textInSource,
  timeInSource,
} from "./source-match";

export const notPrinted = (field: string, value: string): Flag => ({
  field,
  reason: `The AI returned "${value}", but this isn't printed in the document, so it was removed. Please check the original.`,
  evidence: value,
});

/** Removes everything from one flight that the document doesn't print, flagging what staff must check. */
export function groundSegment<S extends ExtractedSegment>(segment: S, index: number, source: string, flags: Flag[]): S {
  const path = (key: string) => `segments.${index}.${key}`;
  const out = { ...segment };

  // Critical values: a wrong one is worse than an empty one. An unprinted airport code
  // needs no warning when the airport's name is printed, since the name is shown instead.
  const required = (key: "flightNumber" | "originCode" | "destinationCode" | "departureTime" | "arrivalTime", found: (value: string, text: string) => boolean, quietIf = false) => {
    const value = segment[key];
    if (value && !found(value, source)) {
      out[key] = null;
      if (!quietIf) flags.push(notPrinted(path(key), value));
    }
  };
  const named = (name: string | null) => Boolean(name && textInSource(name, source));
  required("flightNumber", flightNumberInSource);
  required("originCode", codeInSource, named(segment.originName));
  required("destinationCode", codeInSource, named(segment.destinationName));
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
  // A printed code ("RQ") is not the airline's name.
  if (out.airlineName && out.airlineName.toUpperCase() === segment.airlineCode?.toUpperCase()) out.airlineName = null;

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
