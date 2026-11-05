import "server-only";
import type { Extraction } from "../schema";
import { yearInSource } from "./source-match";

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Next occurrence of the date's month/day on or after `today` (YYYY-MM-DD strings). */
function nextOccurrence(date: string, today: string): string {
  const [, , mm, dd] = ISO.exec(date)!;
  const year = Number(today.slice(0, 4));
  const sameYear = `${year}-${mm}-${dd}`;
  return sameYear >= today ? sameYear : `${year + 1}-${mm}-${dd}`;
}

const shiftYear = (date: string, years: number) => `${Number(date.slice(0, 4)) + years}${date.slice(4)}`;
const yearAssumed = (year: string) => `The document doesn't show the year, so ${year} was assumed. Please confirm.`;
const isYearFlag = (flag: Extraction["uncertainFields"][number]) => /\.(departure|arrival)Date$/.test(flag.field) && /\byear\b/i.test(flag.reason);

/**
 * Supplier quotes often print dates without a year ("Fri 14 Mar"). Models are told to
 * pick the next occurrence but do this arithmetic, and flagging it, unreliably, so
 * it is decided here: a date's year is assumed when the document's text doesn't
 * print it (or, with no text, when the model flagged it). Assumed dates in the past
 * move to their next occurrence. A year that is printed is never changed. Arrival
 * dates move by the same number of years to keep each flight consistent.
 *
 * Staff are asked to confirm once per assumed year, not once per flight, so that a
 * four-flight itinerary doesn't bury the warnings that matter.
 * `source` is null when there is no document text (demo).
 */
export function resolveAssumedYears(data: Extraction, today: string, source: string | null = null): Extraction {
  const modelFlagged = new Set(data.uncertainFields.filter(isYearFlag).map((f) => f.field));
  const uncertainFields = data.uncertainFields.filter((f) => !isYearFlag(f));
  const confirmedYears = new Set<string>();

  const segments = data.segments.map((segment, i) => {
    const field = `segments.${i}.departureDate`;
    const dep = segment.departureDate;
    if (!dep || !ISO.test(dep)) return segment;
    if (source === null ? !modelFlagged.has(field) : yearInSource(dep, source)) return segment;

    const fixed = dep >= today ? dep : nextOccurrence(dep, today);
    const year = fixed.slice(0, 4);
    if (!confirmedYears.has(year)) {
      confirmedYears.add(year);
      uncertainFields.push({ field, reason: yearAssumed(year), evidence: null });
    }
    const years = Number(year) - Number(dep.slice(0, 4));
    return {
      ...segment,
      departureDate: fixed,
      arrivalDate: segment.arrivalDate && ISO.test(segment.arrivalDate) ? shiftYear(segment.arrivalDate, years) : segment.arrivalDate,
    };
  });

  return { ...data, segments, uncertainFields };
}
