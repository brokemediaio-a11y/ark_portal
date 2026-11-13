import type { ExtractedSegment, ItineraryExtraction } from "../schema";

/** Puts the segments in the given order, keeping each flag on its own flight. */
function reorder<T extends ItineraryExtraction>(data: T, order: number[]): T {
  if (order.every((original, index) => original === index)) return data;
  return {
    ...data,
    segments: order.map(index => data.segments[index]),
    uncertainFields: data.uncertainFields.map(flag => {
      const match = /^segments\.(\d+)\.(.+)$/.exec(flag.field);
      const index = match ? order.indexOf(Number(match[1])) : -1;
      return match && index >= 0 ? { ...flag, field: `segments.${index}.${match[2]}` } : flag;
    }),
  };
}

/**
 * A complete, unambiguous set of numbered route headings outranks model array order.
 * Never sort airport-local timestamps globally: time zones and date-line travel differ.
 */
export function orderFlightsBySource<T extends ItineraryExtraction>(data: T, source: string): T {
  const routes = new Map<number, string>();
  for (const match of source.matchAll(/\bFLIGHT\s+(\d+)\s*[-–—:]\s*([^\r\n]+)/gi)) {
    const codes = [...match[2].matchAll(/\(([A-Z]{3})\)/g)].map(code => code[1]);
    if (codes.length !== 2) continue;
    const ordinal = Number(match[1]); const route = codes.join("-");
    if (routes.has(ordinal) && routes.get(ordinal) !== route) return data;
    routes.set(ordinal, route);
  }
  if (routes.size !== data.segments.length || routes.size < 2) return data;
  const headings = [...routes].sort(([a], [b]) => a - b);
  // Restarted numbering across separate documents or repeated routes is ambiguous.
  if (headings.some(([number], i) => number !== i + 1) || new Set(headings.map(([, route]) => route)).size !== routes.size) return data;
  const indices = headings.map(([, route]) => data.segments.flatMap((segment, index) =>
    `${segment.originCode}-${segment.destinationCode}` === route ? [index] : []));
  if (indices.some(matches => matches.length !== 1)) return data;
  return reorder(data, indices.map(matches => matches[0]));
}

/** True when the source holds several uploaded files (see readDocuments). */
export const hasSeveralDocuments = (source: string) => /<document_2[\s>]/.test(source);

/**
 * Same day: a flight that continues from the other's arrival airport comes second. Otherwise the earlier local
 * departure time goes first; on one day that is the travel order except across far-apart time zones.
 */
function sameDayOrder(a: ExtractedSegment, b: ExtractedSegment): number {
  const aThenB = a.destinationCode !== null && a.destinationCode === b.originCode;
  const bThenA = b.destinationCode !== null && b.destinationCode === a.originCode;
  if (aThenB !== bThenA) return aThenB ? -1 : 1;
  if (a.departureTime && b.departureTime && a.departureTime !== b.departureTime) return a.departureTime < b.departureTime ? -1 : 1;
  return 0;
}

/**
 * Flights from separate files have no shared page order: an e-itinerary may hold the outbound and return legs while
 * other files hold the flights in between. They are put in travel order by departure date. Only applied when every
 * flight has a departure date; otherwise the AI's order stands.
 */
export function orderFlightsAcrossDocuments<T extends ItineraryExtraction>(data: T, source: string): T {
  if (!hasSeveralDocuments(source) || data.segments.length < 2 || data.segments.some(s => !s.departureDate)) return data;
  const order = data.segments.map((_, index) => index);
  // Insertion sort: stable, and the same-day rule only ever compares neighbours.
  for (let i = 1; i < order.length; i++) {
    for (let j = i; j > 0; j--) {
      const a = data.segments[order[j - 1]];
      const b = data.segments[order[j]];
      const byDate = a.departureDate! < b.departureDate! ? -1 : a.departureDate! > b.departureDate! ? 1 : sameDayOrder(a, b);
      if (byDate <= 0) break;
      [order[j - 1], order[j]] = [order[j], order[j - 1]];
    }
  }
  return reorder(data, order);
}
