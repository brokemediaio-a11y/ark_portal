import type { ItineraryExtraction } from "../schema";

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
  const order = indices.map(matches => matches[0]);
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
