import { z } from "zod";

/**
 * Provider-neutral flight search types. The UI and quotation code depend only on
 * these — never on a provider's raw response format.
 */

export const IATA_CODE = /^[A-Z]{3}$/;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date");

export const CABIN_CLASSES = ["economy", "premium_economy", "business", "first"] as const;
export type CabinClass = (typeof CABIN_CLASSES)[number];

export const MAX_SLICES = 4;
export const MAX_PASSENGERS = 9;

export const flightSearchRequestSchema = z
  .object({
    slices: z
      .array(
        z.object({
          origin: z.string().trim().toUpperCase().regex(IATA_CODE, "Choose a departure airport"),
          destination: z.string().trim().toUpperCase().regex(IATA_CODE, "Choose an arrival airport"),
          departureDate: isoDate,
        }),
      )
      .min(1)
      .max(MAX_SLICES),
    passengers: z.object({
      adults: z.number().int().min(1, "At least one adult is required"),
      /** Ages 2–17, one entry per child. */
      childAges: z.array(z.number().int().min(2).max(17)),
      /** Ages 0–1, one entry per infant (each travels on an adult's lap). */
      infantAges: z.array(z.number().int().min(0).max(1)),
    }),
    cabinClass: z.enum(CABIN_CLASSES),
    /** null = any number of connections. */
    maxConnections: z.union([z.literal(0), z.literal(1), z.literal(2)]).nullable(),
  })
  .superRefine((r, ctx) => {
    r.slices.forEach((s, i) => {
      if (s.origin === s.destination)
        ctx.addIssue({ code: "custom", message: "Departure and arrival must be different", path: ["slices", i, "destination"] });
      if (i > 0 && s.departureDate < r.slices[i - 1].departureDate)
        ctx.addIssue({ code: "custom", message: "Dates must be in travel order", path: ["slices", i, "departureDate"] });
    });
    const total = r.passengers.adults + r.passengers.childAges.length + r.passengers.infantAges.length;
    if (total > MAX_PASSENGERS)
      ctx.addIssue({ code: "custom", message: `At most ${MAX_PASSENGERS} travellers per search`, path: ["passengers"] });
    if (r.passengers.infantAges.length > r.passengers.adults)
      ctx.addIssue({ code: "custom", message: "Each infant must travel with an adult", path: ["passengers"] });
  });

export type FlightSearchRequest = z.infer<typeof flightSearchRequestSchema>;

export interface Place {
  /** IATA code of the airport or city (cities cover all their airports, e.g. LON). */
  iata: string;
  type: "airport" | "city";
  name: string;
  cityName: string | null;
  countryCode: string | null;
  /** For cities: the airport codes included. */
  airports: string[];
}

export interface Carrier {
  iata: string | null;
  name: string | null;
}

export interface Baggage {
  /** Number of checked bags included, or null when the airline didn't say. */
  checked: number | null;
  carryOn: number | null;
}

export interface OfferSegment {
  id: string;
  marketing: Carrier & { flightNumber: string | null };
  operating: Carrier & { flightNumber: string | null };
  origin: Place;
  destination: Place;
  /** Local date-time at the airport, "YYYY-MM-DDTHH:mm". */
  departingAt: string;
  arrivingAt: string;
  durationMinutes: number | null;
  originTerminal: string | null;
  destinationTerminal: string | null;
  aircraft: string | null;
  cabin: string | null;
  /** Allowance for the first passenger on this segment. */
  baggage: Baggage | null;
  /** Technical stops without changing aircraft. */
  technicalStops: number;
}

export interface OfferSlice {
  id: string;
  origin: Place;
  destination: Place;
  durationMinutes: number | null;
  fareBrand: string | null;
  segments: OfferSegment[];
}

export interface FareCondition {
  allowed: boolean;
  penaltyAmount: number | null;
  penaltyCurrency: string | null;
}

/** A priced, bookable itinerary (all slices together) from a fare provider. */
export interface FlightOffer {
  id: string;
  offerRequestId: string;
  provider: string;
  /** false = provider test environment: not a real fare. */
  liveMode: boolean;
  /** When the provider stops honouring this offer (ISO timestamp). */
  expiresAt: string | null;
  owner: Carrier;
  totalAmount: number;
  totalCurrency: string;
  baseAmount: number | null;
  taxAmount: number | null;
  slices: OfferSlice[];
  conditions: { change: FareCondition | null; refund: FareCondition | null };
  passengers: { id: string; type: string | null; age: number | null }[];
  emissionsKg: number | null;
}

export interface ProviderInfo {
  id: string;
  label: string;
  /** false = test/sandbox data (shown with a TEST MODE label everywhere). */
  liveMode: boolean;
}

export type FlightSearchErrorCode =
  | "invalid_request"
  | "not_configured"
  | "rate_limited"
  | "offer_expired"
  | "provider_unavailable"
  | "timeout";

export type FlightSearchResponse =
  | { ok: true; provider: ProviderInfo; offerRequestId: string; offers: FlightOffer[]; searchedAt: string }
  | { ok: false; error: string; code: FlightSearchErrorCode; field?: string };

export type OfferResponse =
  | { ok: true; provider: ProviderInfo; offer: FlightOffer; refreshedAt: string }
  | { ok: false; error: string; code: FlightSearchErrorCode };

export type LocationsResponse =
  | { ok: true; places: Place[] }
  | { ok: false; error: string; code: FlightSearchErrorCode };
