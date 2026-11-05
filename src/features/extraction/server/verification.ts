import "server-only";
import type { ExtractedSegment, Extraction } from "../schema";
import { amountInSource, dateInSource, flightNumberInSource, textInSource, timeInSource } from "./source-match";

type Flag = Extraction["uncertainFields"][number];

const disagreement = (field: string, value: string): Flag => ({
  field,
  reason: `Two independent readings of the document don't agree on "${value}". Please compare it with the original.`,
  evidence: value,
});

/** Flags any critical value of a scanned document that isn't supported by both readings. */
export function checkAgainstReads(data: Extraction, reads: readonly string[]): Extraction {
  const inEveryRead = (found: (value: string, text: string) => boolean, value: string) => reads.every((read) => found(value, read));
  const flags: Flag[] = [];
  data.segments.forEach((s, i) => {
    const check = (key: keyof ExtractedSegment, found: (value: string, text: string) => boolean) => {
      const value = s[key];
      if (typeof value === "string" && value && !inEveryRead(found, value)) flags.push(disagreement(`segments.${i}.${key}`, value));
    };
    check("flightNumber", flightNumberInSource);
    check("originCode", textInSource);
    check("destinationCode", textInSource);
    check("departureDate", dateInSource);
    check("departureTime", timeInSource);
    check("arrivalDate", dateInSource);
    check("arrivalTime", timeInSource);
  });
  if (data.totalAmount !== null && !reads.every((read) => amountInSource(data.totalAmount!, read))) flags.push(disagreement("sourceTotal", String(data.totalAmount)));
  return { ...data, uncertainFields: [...data.uncertainFields, ...flags] };
}

const sameFlight = (a: ExtractedSegment, b: ExtractedSegment) =>
  a.flightNumber !== null && a.flightNumber === b.flightNumber && a.departureDate === b.departureDate && a.originCode === b.originCode && a.destinationCode === b.destinationCode;

const localMoment = (date: string | null, time: string | null) => (date && time ? `${date}T${time.padStart(5, "0")}` : null);

/** Page slices overlap, so a flight can be listed twice. Keeps the first, and keeps flags on the right flights. */
export function mergeRepeatedFlights(data: Extraction): Extraction {
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
export function checkItinerary(data: Extraction): Extraction {
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
