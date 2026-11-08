import { z } from "zod";

/**
 * Exact shape the AI must return. Every field is required-but-nullable so the
 * model has to say "unknown" (null) explicitly instead of omitting or guessing.
 * Kept free of transforms so it converts cleanly to a strict JSON schema.
 */
const text = z.string().nullable();
// No int/min bounds here: not every OpenAI-compatible provider supports them.
// Counts are sanitised when mapped into a quotation (factory.ts).
const count = z.number().nullable();

export const extractedSegmentSchema = z.object({
  airlineName: text,
  airlineCode: text.describe("IATA airline designator, e.g. EK"),
  flightNumber: text.describe("Flight number including airline code if shown, e.g. EK 623"),
  originCode: text.describe("3-letter IATA airport code"),
  originName: text.describe("City or airport name as written"),
  destinationCode: text.describe("3-letter IATA airport code"),
  destinationName: text,
  departureDate: text.describe("YYYY-MM-DD"),
  departureTime: text.describe("HH:mm 24-hour, local time"),
  arrivalDate: text.describe("YYYY-MM-DD"),
  arrivalTime: text.describe("HH:mm 24-hour, local time"),
  duration: text.describe("As written, e.g. 3h 15m"),
  stops: count,
  cabin: text.describe("e.g. Economy, Business"),
  baggage: text.describe("Baggage allowance exactly as written"),
});

export const extractionSchema = z.object({
  documentHasFlightDetails: z.boolean(),
  segments: z.array(extractedSegmentSchema),
  passengers: z.object({ adults: count, children: count, infants: count }),
  currency: text.describe("ISO 4217 code, e.g. PKR, USD, AED"),
  baseAmount: z.number().nullable(),
  taxAmount: z.number().nullable(),
  totalAmount: z.number().nullable().describe("Total price for the whole itinerary"),
  fareConditions: text.describe("Refund/change rules exactly as written"),
  sourceReference: text.describe("Supplier quote or reference number, if any"),
  customerName: text,
  uncertainFields: z.array(
    z.object({
      field: z.string().describe('Path such as "segments.0.departureTime" or "currency"'),
      reason: z.string(),
      evidence: z.string().nullable().describe("Short snippet of source text"),
    }),
  ),
});

export type ExtractedSegment = z.infer<typeof extractedSegmentSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
export type UncertainField = Extraction["uncertainFields"][number];

/** What quotations and tickets have in common, so the flight checks work on both. */
export interface ItineraryExtraction<S extends ExtractedSegment = ExtractedSegment> {
  segments: S[];
  uncertainFields: UncertainField[];
}

/** Response body of the extraction endpoints (quotations and tickets). */
export type ExtractResponse<T = Extraction> =
  | { ok: true; data: T; method: ExtractionMethod; demo: boolean }
  | { ok: false; error: string; code: ExtractErrorCode };

export type ExtractionMethod = "pdf-text" | "vision" | "demo";

export type ExtractErrorCode =
  | "invalid_file"
  | "not_configured"
  | "no_flight_details"
  | "ai_failed"
  | "rate_limited";
