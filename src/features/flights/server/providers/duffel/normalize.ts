import type { Baggage, Carrier, FareCondition, FlightOffer, FlightSearchRequest, OfferSegment, Place } from "../../../schema";
import type { RawOffer, RawPlace } from "./raw-schemas";

/** Pure Duffel ↔ app conversions (no I/O), so they are fully unit-testable. */

/** ISO 8601 duration ("P1DT5H30M", "PT7H10M") → minutes. */
export function parseIsoDuration(value: string | null): number | null {
  if (!value) return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(value);
  if (!m) return null;
  const [, d = "0", h = "0", min = "0"] = m;
  return Number(d) * 1440 + Number(h) * 60 + Number(min);
}

const amount = (v: string | null) => {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** "2026-11-02T08:15:00" → "2026-11-02T08:15" (airport local time, no zone shifting). */
const localDateTime = (v: string) => v.slice(0, 16);

export function toPlace(p: RawPlace): Place {
  return {
    iata: p.iata_code ?? "",
    type: p.type === "city" ? "city" : "airport",
    name: p.name ?? p.iata_code ?? "",
    cityName: p.city_name ?? (p.type === "city" ? p.name : null),
    countryCode: p.iata_country_code,
    airports: (p.airports ?? []).flatMap((a) => (a.iata_code ? [a.iata_code] : [])),
  };
}

const toCarrier = (c: { iata_code: string | null; name: string | null } | null | undefined): Carrier => ({
  iata: c?.iata_code ?? null,
  name: c?.name ?? null,
});

function toCondition(c: { allowed: boolean; penalty_amount: string | null; penalty_currency: string | null } | null): FareCondition | null {
  return c ? { allowed: c.allowed, penaltyAmount: amount(c.penalty_amount), penaltyCurrency: c.penalty_currency } : null;
}

/** Only report what the airline returned; never infer allowances. */
function toBaggage(bags: { type: string; quantity: number }[] | null | undefined): Baggage | null {
  if (!bags) return null;
  const count = (type: string) => {
    const matching = bags.filter((b) => b.type === type);
    return matching.length ? matching.reduce((sum, b) => sum + b.quantity, 0) : 0;
  };
  return { checked: count("checked"), carryOn: count("carry_on") };
}

export function toOffer(raw: RawOffer, offerRequestId: string, provider: string): FlightOffer {
  const sameCurrency = (c: string | null) => c === raw.total_currency;
  return {
    id: raw.id,
    offerRequestId,
    provider,
    liveMode: raw.live_mode,
    expiresAt: raw.expires_at,
    owner: toCarrier(raw.owner),
    totalAmount: Number(raw.total_amount),
    totalCurrency: raw.total_currency,
    // Base/tax are only meaningful next to the total if they share its currency.
    baseAmount: sameCurrency(raw.base_currency) ? amount(raw.base_amount) : null,
    taxAmount: sameCurrency(raw.tax_currency) ? amount(raw.tax_amount) : null,
    emissionsKg: amount(raw.total_emissions_kg),
    conditions: {
      change: toCondition(raw.conditions?.change_before_departure ?? null),
      refund: toCondition(raw.conditions?.refund_before_departure ?? null),
    },
    passengers: raw.passengers.map((p) => ({ id: p.id, type: p.type, age: p.age ?? null })),
    slices: raw.slices.map((s) => ({
      id: s.id,
      origin: toPlace(s.origin),
      destination: toPlace(s.destination),
      durationMinutes: parseIsoDuration(s.duration),
      fareBrand: s.fare_brand_name,
      segments: s.segments.map(
        (seg): OfferSegment => ({
          id: seg.id,
          marketing: { ...toCarrier(seg.marketing_carrier), flightNumber: seg.marketing_carrier_flight_number },
          operating: { ...toCarrier(seg.operating_carrier), flightNumber: seg.operating_carrier_flight_number },
          origin: toPlace(seg.origin),
          destination: toPlace(seg.destination),
          departingAt: localDateTime(seg.departing_at),
          arrivingAt: localDateTime(seg.arriving_at),
          durationMinutes: parseIsoDuration(seg.duration),
          originTerminal: seg.origin_terminal,
          destinationTerminal: seg.destination_terminal,
          aircraft: seg.aircraft?.name ?? null,
          cabin: seg.passengers?.[0]?.cabin_class_marketing_name ?? seg.passengers?.[0]?.cabin_class ?? null,
          baggage: toBaggage(seg.passengers?.[0]?.baggages),
          technicalStops: seg.stops?.length ?? 0,
        }),
      ),
    })),
  };
}

/** App search request → Duffel offer request body. */
export function toOfferRequestBody(r: FlightSearchRequest) {
  return {
    slices: r.slices.map((s) => ({ origin: s.origin, destination: s.destination, departure_date: s.departureDate })),
    passengers: [
      ...Array.from({ length: r.passengers.adults }, () => ({ type: "adult" })),
      // Duffel derives child/infant pricing from age.
      ...r.passengers.childAges.map((age) => ({ age })),
      ...r.passengers.infantAges.map((age) => ({ age })),
    ],
    cabin_class: r.cabinClass,
    ...(r.maxConnections === null ? {} : { max_connections: r.maxConnections }),
  };
}
