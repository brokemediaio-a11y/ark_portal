import { z } from "zod";
import { brand } from "@/config/brand";

/** Optional text: empty strings are stored as null so "missing" has one meaning. */
const optionalText = z
  .string()
  .trim()
  .nullable()
  .transform((v) => (v ? v : null));

export const IATA_CODE = /^[A-Z]{3}$/;
export const AIRLINE_CODE = /^[A-Z0-9]{2,3}$/;
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_24H = /^([01]\d|2[0-3]):[0-5]\d$/;
export const CURRENCY_CODE = /^[A-Z]{3}$/;

/** One flight's fields. Extended by e-tickets; see flightSegmentSchema for the stored form. */
export const flightSegmentShape = z.object({
  id: z.string(),
  airlineName: optionalText,
  airlineCode: optionalText,
  flightNumber: optionalText,
  originCode: optionalText,
  originName: optionalText,
  destinationCode: optionalText,
  destinationName: optionalText,
  /** YYYY-MM-DD, local to the departure airport. */
  departureDate: optionalText,
  /** HH:mm (24h), local to the departure airport. */
  departureTime: optionalText,
  arrivalDate: optionalText,
  arrivalTime: optionalText,
  duration: optionalText,
  stops: z.number().int().min(0).nullable(),
  cabin: optionalText,
  /** Hand carry (cabin) allowance, e.g. "7 kg". */
  handCarry: optionalText.default(null),
  /** Check-in (hold) allowance, e.g. "30 kg". */
  checkIn: optionalText.default(null),
});

/**
 * Documents saved before baggage was split had one "baggage" value, which on supplier
 * documents is almost always the checked allowance: it becomes "check in".
 */
export function withLegacyBaggage<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => {
    if (!value || typeof value !== "object" || !("baggage" in value)) return value;
    const { baggage, ...segment } = value as Record<string, unknown>;
    return segment.checkIn != null ? segment : { ...segment, checkIn: baggage ?? null };
  }, schema);
}

export const flightSegmentSchema = withLegacyBaggage(flightSegmentShape);

export const markupSchema = z.object({
  type: z.enum(["fixed", "percentage"]),
  value: z.number().min(0),
});

export const passengersSchema = z.object({
  adults: z.number().int().min(0).nullable(),
  children: z.number().int().min(0).nullable(),
  infants: z.number().int().min(0).nullable(),
});

export const customerSchema = z.object({
  name: optionalText,
  email: optionalText,
  phone: optionalText,
});

export const QUOTATION_STATUSES = ["draft", "ready", "sent", "archived"] as const;
export const SOURCE_TYPES = ["upload", "manual", "demo", "flight_search"] as const;

/** A field the AI (or validation) flagged for a human to double-check. */
export const reviewFlagSchema = z.object({
  /** Dot path into the quotation, e.g. "segments.0.departureDate" or "currency". */
  field: z.string(),
  reason: z.string(),
  evidence: z.string().nullable(),
});

export const providerSnapshotSchema = z.object({
  provider: z.string(),
  offerRequestId: z.string(),
  offerId: z.string(),
  /** false = provider test environment, not a real fare. */
  liveMode: z.boolean(),
  totalAmount: z.number(),
  totalCurrency: z.string(),
  /** When the provider stops honouring the fare. */
  expiresAt: z.string().nullable(),
  /** When the price was last re-checked with the provider. */
  refreshedAt: z.string(),
});
export type ProviderSnapshot = z.infer<typeof providerSnapshotSchema>;

export const quotationSchema = z.object({
  id: z.string(),
  quoteNumber: z.string(),
  status: z.enum(QUOTATION_STATUSES),
  sourceType: z.enum(SOURCE_TYPES),
  sourceReference: optionalText,
  /** Which data provider the flights came from (e.g. "Duffel (test mode)"). Defaulted for older saved quotations. */
  sourceProvider: z.string().nullable().default(null),
  /**
   * Immutable record of the provider offer this quotation was priced from. Staff
   * can edit the visible fields; these ids and amounts are never changed.
   */
  providerSnapshot: providerSnapshotSchema.nullable().default(null),
  sourceFileName: optionalText,
  customer: customerSchema,
  passengers: passengersSchema,
  segments: z.array(flightSegmentSchema),
  currency: optionalText,
  baseAmount: z.number().min(0).nullable(),
  taxAmount: z.number().min(0).nullable(),
  /** Supplier's total price — internal, never printed on the customer PDF. */
  sourceTotal: z.number().min(0).nullable(),
  markup: markupSchema,
  fareConditions: optionalText,
  notes: optionalText,
  termsText: optionalText,
  /** Dari terms printed beside the English ones. Older quotations get the default. */
  termsTextDari: optionalText.default(brand.defaultTermsDari),
  /** Flags raised at extraction time; staff dismiss them as they review. */
  reviewFlags: z.array(reviewFlagSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type FlightSegment = z.infer<typeof flightSegmentSchema>;
export type Markup = z.infer<typeof markupSchema>;
export type Passengers = z.infer<typeof passengersSchema>;
export type Customer = z.infer<typeof customerSchema>;
export type ReviewFlag = z.infer<typeof reviewFlagSchema>;
export type Quotation = z.infer<typeof quotationSchema>;
export type QuotationStatus = Quotation["status"];
export type SourceType = Quotation["sourceType"];
