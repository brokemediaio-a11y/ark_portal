import "server-only";
import type { Extraction } from "../schema";

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Next occurrence of the date's month/day on or after `today` (YYYY-MM-DD strings). */
function nextOccurrence(date: string, today: string): string {
  const [, , mm, dd] = ISO.exec(date)!;
  const year = Number(today.slice(0, 4));
  const sameYear = `${year}-${mm}-${dd}`;
  return sameYear >= today ? sameYear : `${year + 1}-${mm}-${dd}`;
}

const shiftYear = (date: string, years: number) => `${Number(date.slice(0, 4)) + years}${date.slice(4)}`;

/**
 * Supplier quotes often print dates without a year ("Fri 14 Mar"). Models are told to
 * pick the next occurrence but do this arithmetic unreliably, so we do it here.
 * Only departure dates the model itself flagged as uncertain AND that landed in the
 * past are moved; the flag stays so staff confirm the year. Arrival dates move by
 * the same number of years to keep each flight consistent.
 */
export function resolveAssumedYears(data: Extraction, today: string): Extraction {
  const flagged = new Set(data.uncertainFields.map((f) => f.field));
  const uncertainFields = [...data.uncertainFields];

  const segments = data.segments.map((segment, i) => {
    const field = `segments.${i}.departureDate`;
    const dep = segment.departureDate;
    if (!dep || !ISO.test(dep) || !flagged.has(field) || dep >= today) return segment;

    const fixed = nextOccurrence(dep, today);
    const years = Number(fixed.slice(0, 4)) - Number(dep.slice(0, 4));
    const flagIndex = uncertainFields.findIndex((f) => f.field === field);
    uncertainFields[flagIndex] = {
      ...uncertainFields[flagIndex],
      reason: `The document doesn't show the year, so ${fixed.slice(0, 4)} was assumed. Please confirm.`,
    };
    return {
      ...segment,
      departureDate: fixed,
      arrivalDate: segment.arrivalDate && ISO.test(segment.arrivalDate) ? shiftYear(segment.arrivalDate, years) : segment.arrivalDate,
    };
  });

  return { ...data, segments, uncertainFields };
}
