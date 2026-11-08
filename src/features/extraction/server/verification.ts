import "server-only";
import type { ExtractedSegment, ItineraryExtraction, UncertainField as Flag } from "../schema";
import { codeInSource, dateInSource, flightNumberInSource, flightNumberIndex, hasClockTime, hasDate, timeInSource } from "./source-match";

export const disagreement = (field: string, value: string): Flag => ({
  field,
  reason: `Two independent readings of the document don't agree on "${value}". Please compare it with the original.`,
  evidence: value,
});

const FIRST_WINDOW_LOOKBACK = 250;

/**
 * The part of a reading that belongs to one flight: from the previous flight's
 * number to the next one's. The whole reading when the flight number isn't found.
 */
function flightWindow(read: string, segments: readonly ExtractedSegment[], index: number): string {
  const positions = segments.map((s) => (s.flightNumber ? flightNumberIndex(s.flightNumber, read) : -1));
  const at = positions[index];
  if (at < 0) return read;
  // The first flight's window doesn't reach back into page headers and print stamps.
  const start = Math.max(0, at - FIRST_WINDOW_LOOKBACK, ...positions.filter((p) => p >= 0 && p < at));
  const end = Math.min(read.length, ...positions.filter((p) => p > at));
  return read.slice(start, end);
}

/**
 * Flags any critical value of a scanned document that a reading contradicts.
 * A reading that has no time (or date) at all for that flight just missed the
 * cell, which isn't a contradiction, so it is ignored for that value.
 */
export function checkAgainstReads<T extends ItineraryExtraction>(data: T, reads: readonly string[]): T {
  const flags: Flag[] = [];
  data.segments.forEach((s, i) => {
    const check = (key: keyof ExtractedSegment, found: (value: string, text: string) => boolean, kindPresent: (text: string) => boolean = () => true) => {
      const value = s[key];
      if (typeof value !== "string" || !value) return;
      const contradicted = reads.some((read) => {
        const text = flightWindow(read, data.segments, i);
        return kindPresent(text) && !found(value, text);
      });
      if (contradicted) flags.push(disagreement(`segments.${i}.${key}`, value));
    };
    check("flightNumber", flightNumberInSource);
    check("originCode", codeInSource);
    check("destinationCode", codeInSource);
    check("departureDate", dateInSource, hasDate);
    check("departureTime", timeInSource, hasClockTime);
    check("arrivalDate", dateInSource, hasDate);
    check("arrivalTime", timeInSource, hasClockTime);
  });
  return withFlags(data, flags);
}

/** Adds flags, keeping one per field so staff aren't asked twice about the same value. */
export function withFlags<T extends { uncertainFields: Flag[] }>(data: T, flags: Flag[]): T {
  const seen = new Set<string>();
  const uncertainFields = [...data.uncertainFields, ...flags].filter((f) => !seen.has(f.field) && seen.add(f.field));
  return { ...data, uncertainFields };
}

const sameFlight = (a: ExtractedSegment, b: ExtractedSegment) =>
  a.flightNumber !== null && a.flightNumber === b.flightNumber && a.departureDate === b.departureDate && a.originCode === b.originCode && a.destinationCode === b.destinationCode;

const localMoment = (date: string | null, time: string | null) => (date && time ? `${date}T${time.padStart(5, "0")}` : null);

/** Page slices overlap, so a flight can be listed twice. Keeps the first, and keeps flags on the right flights. */
export function mergeRepeatedFlights<T extends ItineraryExtraction>(data: T): T {
  const kept = data.segments.flatMap((s, i) => (data.segments.slice(0, i).some((earlier) => sameFlight(earlier, s)) ? [] : [i]));
  if (kept.length === data.segments.length) return data;
  const uncertainFields = data.uncertainFields.flatMap((flag) => {
    const m = /^segments\.(\d+)\.(.+)$/.exec(flag.field);
    if (!m) return [flag];
    const index = kept.indexOf(Number(m[1]));
    return index < 0 ? [] : [{ ...flag, field: `segments.${index}.${m[2]}` }];
  });
  return { ...data, segments: kept.map((i) => data.segments[i]), uncertainFields };
}

/** Rules any real itinerary obeys, whatever the document looks like. Run after years are resolved. */
export function checkItinerary<T extends ItineraryExtraction>(data: T): T {
  const { segments } = data;
  const flags: Flag[] = [];

  segments.forEach((s, i) => {
    const path = (key: string) => `segments.${i}.${key}`;
    if (s.departureDate && s.arrivalDate && s.arrivalDate < s.departureDate)
      flags.push({ field: path("arrivalDate"), reason: "This flight arrives on a date before it departs.", evidence: null });

    const previous = segments[i - 1];
    if (!previous) return;
    const arrived = localMoment(previous.arrivalDate, previous.arrivalTime);
    const leaves = localMoment(s.departureDate, s.departureTime);
    // Times at the same airport share a time zone, so these can be compared directly.
    if (arrived && leaves && previous.destinationCode === s.originCode && leaves < arrived)
      flags.push({ field: path("departureTime"), reason: `This flight departs before the previous one arrives in ${s.originCode}.`, evidence: null });

    const reused = s.flightNumber && segments.slice(0, i).some((other) => other.flightNumber === s.flightNumber && other.originCode !== s.originCode);
    if (reused)
      flags.push({ field: path("flightNumber"), reason: `${s.flightNumber} is used on two different routes. Please check it against the original.`, evidence: s.flightNumber });
  });

  return { ...data, uncertainFields: [...data.uncertainFields, ...flags] };
}
