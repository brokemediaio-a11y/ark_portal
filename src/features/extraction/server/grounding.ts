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

/**
 * "ISTANBUL IST" or "Kabul (KBL)": an airport code printed after the name belongs in the code, not the name. Only a
 * token that is clearly a code is split off: the segment's own code, one in brackets, or one the document prints
 * twice in a row ("ISTANBUL IST IST"). A last word that may be part of the name ("La Paz") stays, and so does a code
 * that contradicts the segment's own.
 */
export function splitTrailingCode(name: string | null, code: string | null, source: string): { name: string | null; code: string | null } {
  const m = name ? /^(.*\p{L}.*?)\s+(\()?([A-Z]{3})\)?(?:\s+\(?\3\)?)*$/u.exec(name.trim()) : null;
  if (!m || (code && code !== m[3])) return { name, code };
  const token = m[3];
  const clearlyCode = code === token || Boolean(m[2]) || new RegExp(`(?<![A-Za-z])${token}\\s+${token}(?![A-Za-z])`).test(source);
  return clearlyCode ? { name: m[1].replace(/[\s,–-]+$/, ""), code: code ?? token } : { name, code };
}

/**
 * A travel agency, booking site or ticket provider ("OrientTrips", "Trip.com", "Ark Travelers") rather than an airline:
 * its name sells trips or tickets and has no airline word in it. Airline websites are printed on tickets too, so a
 * website alone says nothing.
 */
export function isTicketProviderName(name: string): boolean {
  return /trip|travel|tour|booking|ticket|agency|holiday|reise|resor|safar/i.test(name) && !/\bair|airline|airway|aviation|aero|jet\b/i.test(name);
}

/** "Turkish Airlines TK1800" → "Turkish Airlines": an airline name printed directly before the flight number. */
export function airlineNamedBefore(code: string, digits: string, source: string): string | null {
  const name = String.raw`((?:\p{Lu}[\p{L}'’.&-]*\s+){0,3}(?:Airlines?|Airways|Air|Aviation|Aero\p{L}*|Jet\p{L}*))`;
  const match = new RegExp(String.raw`${name}\s+${code}[\s-]*0*${digits}(?!\d)`, "u").exec(source);
  return match && !isTicketProviderName(match[1]) ? match[1] : null;
}

/** Removes everything from one flight that the document doesn't print, flagging what staff must check. */
export function groundSegment<S extends ExtractedSegment>(input: S, index: number, source: string, flags: Flag[]): S {
  const origin = splitTrailingCode(input.originName, input.originCode, source);
  const destination = splitTrailingCode(input.destinationName, input.destinationCode, source);
  const segment: S = { ...input, originName: origin.name, originCode: origin.code, destinationName: destination.name, destinationCode: destination.code };
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
  for (const key of ["airlineName", "originName", "destinationName", "cabin"] as const) {
    const value = segment[key];
    if (value && !textInSource(value, source)) out[key] = null;
  }
  // An allowance may combine two printed ones ("4 kg + 8 kg": personal item and carry-on); each part must be printed.
  for (const key of ["handCarry", "checkIn"] as const) {
    const value = segment[key];
    if (value && !value.split("+").every((part) => part.trim() && textInSource(part, source))) out[key] = null;
  }
  // A booking website or ticket provider ("OrientTrips") is not the airline.
  if (out.airlineName && isTicketProviderName(out.airlineName)) out.airlineName = null;
  // What the flight number itself prints: its carrier code ("TK" in "TK1800"), and an airline name printed right
  // before it ("Turkish Airlines TK1800"), which the AI sometimes leaves out of one answer but not the next.
  const printed = out.flightNumber ? /^\s*([A-Z0-9]{2})[\s-]*0*(\d{1,4})[A-Z]?\s*$/i.exec(out.flightNumber) : null;
  if (printed && /[A-Z]/i.test(printed[1])) {
    const code = printed[1].toUpperCase();
    if (!out.airlineCode) out.airlineCode = code;
    if (!out.airlineName && out.airlineCode === code) out.airlineName = airlineNamedBefore(code, printed[2], source);
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
