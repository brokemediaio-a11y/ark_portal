import "server-only";
import type { Extraction, ExtractedSegment } from "../schema";

/**
 * Deterministic "copy only what is printed" check for documents whose text we have
 * (text-layer PDFs). Smaller models sometimes expand codes into names ("QR" →
 * "Qatar Airways", "LHE" → "Lahore"); any free-text value that does not appear in
 * the source text is removed so staff fill it in instead of trusting a guess.
 */
const SEGMENT_TEXT_FIELDS = [
  "airlineName",
  "originName",
  "destinationName",
  "flightNumber",
  "cabin",
  "baggage",
] as const satisfies readonly (keyof ExtractedSegment)[];

/** Lowercase, drop whitespace and punctuation so "EK 623" matches "EK623" and "30 KG" matches "30KG". */
const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export function groundInSourceText(data: Extraction, sourceText: string): Extraction {
  const haystack = normalize(sourceText);
  const keep = (value: string | null) => (value && haystack.includes(normalize(value)) ? value : null);

  return {
    ...data,
    segments: data.segments.map((segment) => {
      const grounded = { ...segment };
      for (const field of SEGMENT_TEXT_FIELDS) grounded[field] = keep(segment[field]);
      return grounded;
    }),
    sourceReference: keep(data.sourceReference),
    customerName: keep(data.customerName),
  };
}
