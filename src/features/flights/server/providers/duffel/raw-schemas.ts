import { z } from "zod";

/** Duffel v2 response shapes — only the fields we use; unknown fields are ignored. */

const str = z.string().nullish().transform((v) => v ?? null);

export const rawPlaceSchema = z.object({
  iata_code: str,
  name: str,
  type: z.string().nullish(),
  city_name: str,
  iata_country_code: str,
  airports: z.array(z.object({ iata_code: str })).nullish(),
});
export type RawPlace = z.infer<typeof rawPlaceSchema>;

const rawCarrierSchema = z.object({ iata_code: str, name: str }).nullish();

const rawSegmentSchema = z.object({
  id: z.string(),
  departing_at: z.string(),
  arriving_at: z.string(),
  duration: str,
  origin: rawPlaceSchema,
  destination: rawPlaceSchema,
  origin_terminal: str,
  destination_terminal: str,
  marketing_carrier: rawCarrierSchema,
  marketing_carrier_flight_number: str,
  operating_carrier: rawCarrierSchema,
  operating_carrier_flight_number: str,
  aircraft: z.object({ name: str }).nullish(),
  stops: z.array(z.unknown()).nullish(),
  passengers: z
    .array(
      z.object({
        passenger_id: z.string().nullish(),
        cabin_class_marketing_name: str,
        cabin_class: str,
        baggages: z.array(z.object({ type: z.string(), quantity: z.number() })).nullish(),
      }),
    )
    .nullish(),
});

const rawConditionSchema = z
  .object({ allowed: z.boolean(), penalty_amount: str, penalty_currency: str })
  .nullish()
  .transform((v) => v ?? null);

export const rawOfferSchema = z.object({
  id: z.string(),
  live_mode: z.boolean(),
  expires_at: str,
  total_amount: z.string(),
  total_currency: z.string(),
  base_amount: str,
  base_currency: str,
  tax_amount: str,
  tax_currency: str,
  total_emissions_kg: str,
  owner: rawCarrierSchema,
  conditions: z.object({ change_before_departure: rawConditionSchema, refund_before_departure: rawConditionSchema }).nullish(),
  passengers: z.array(z.object({ id: z.string(), type: str, age: z.number().nullish() })),
  slices: z.array(
    z.object({
      id: z.string(),
      duration: str,
      fare_brand_name: str,
      origin: rawPlaceSchema,
      destination: rawPlaceSchema,
      segments: z.array(rawSegmentSchema).min(1),
    }),
  ),
});
export type RawOffer = z.infer<typeof rawOfferSchema>;

/** An array where malformed items are skipped instead of failing the whole response. */
export const lenientList = <T extends z.ZodTypeAny>(item: T) =>
  z.array(z.unknown()).transform((items) =>
    items.flatMap((raw) => {
      const parsed = item.safeParse(raw);
      return parsed.success ? [parsed.data as z.output<T>] : [];
    }),
  );

export const rawOfferRequestSchema = z.object({
  id: z.string(),
  live_mode: z.boolean(),
  offers: lenientList(rawOfferSchema),
});
