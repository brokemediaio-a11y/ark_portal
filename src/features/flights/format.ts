import { formatIsoDate } from "@/features/quotation/customer-view";
import { formatMoney } from "@/features/quotation/pricing";
import type { Baggage, FareCondition, FlightOffer, OfferSegment, Place } from "./schema";

/** Display helpers shared by the results screen and the quotation mapping. */

export function formatDuration(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

/** "EY" + "0078" → "EY 78". */
export function flightNumberLabel(airlineIata: string | null, number: string | null): string | null {
  if (!number) return null;
  const n = number.replace(/^0+(?=\d)/, "");
  return airlineIata ? `${airlineIata} ${n}` : n;
}

/** "2026-11-02T08:15" → { date: "2026-11-02", time: "08:15" } */
export const splitLocal = (dt: string) => ({ date: dt.slice(0, 10), time: dt.slice(11, 16) });

/** Minutes between two airport-local times (used for layovers at the same airport/city). */
export function minutesBetween(fromLocal: string, toLocal: string): number {
  return Math.round((Date.parse(`${toLocal}:00Z`) - Date.parse(`${fromLocal}:00Z`)) / 60_000);
}

/** "+1" when arrival is on a later calendar day than departure, else null. */
export function dayShiftLabel(departureDate: string, arrivalDate: string): string | null {
  const diff = Math.round((Date.parse(`${arrivalDate}T00:00:00Z`) - Date.parse(`${departureDate}T00:00:00Z`)) / 86_400_000);
  return diff === 0 ? null : diff > 0 ? `+${diff}` : String(diff);
}

export const dateLabel = (isoDate: string) => formatIsoDate(isoDate) ?? isoDate;

export const placeLabel = (p: Place) => (p.type === "city" ? `${p.name} (all airports)` : (p.cityName ?? p.name));
export const placeTitle = (p: Place) => `${p.type === "city" ? p.name : (p.cityName ?? p.name)} (${p.iata})`;

/** Only what the airline returned; null means "not provided". */
export function baggageLabel(b: Baggage | null): string | null {
  if (!b) return null;
  const parts = [
    b.checked ? `${b.checked} checked bag${b.checked > 1 ? "s" : ""}` : "No checked bag",
    b.carryOn ? `${b.carryOn} carry-on` : null,
  ].filter(Boolean);
  return parts.join(", ");
}

const bags = (n: number) => `${n} bag${n > 1 ? "s" : ""}`;

/** Allowances for a quotation's baggage fields; null when the airline didn't say, "None" when it said zero. */
export const handCarryLabel = (b: Baggage | null) => (b?.carryOn == null ? null : b.carryOn === 0 ? "None" : bags(b.carryOn));
export const checkInLabel = (b: Baggage | null) => (b?.checked == null ? null : b.checked === 0 ? "None" : bags(b.checked));

function conditionLabel(name: string, c: FareCondition | null): string | null {
  if (!c) return null;
  if (!c.allowed) return `${name}: not allowed`;
  if (c.penaltyAmount === null) return `${name}: allowed`;
  if (c.penaltyAmount === 0) return `${name}: allowed free of charge`;
  return `${name}: allowed (fee ${formatMoney(c.penaltyAmount, c.penaltyCurrency)})`;
}

/** e.g. "Changes: not allowed. Refunds: allowed (fee €70.00)." — null when the airline gave none. */
export function conditionsLabel(conditions: FlightOffer["conditions"]): string | null {
  const parts = [conditionLabel("Changes before departure", conditions.change), conditionLabel("Refunds before departure", conditions.refund)].filter(Boolean);
  return parts.length ? `${parts.join(". ")}.` : null;
}

export const stopsLabel = (stops: number) => (stops === 0 ? "Direct" : `${stops} stop${stops > 1 ? "s" : ""}`);

/** One line for the whole offer: the allowance if every flight has the same one, otherwise a pointer to the details. */
export function offerBaggageLabel(offer: FlightOffer): string {
  const labels = new Set(offer.slices.flatMap((slice) => slice.segments.map((s) => baggageLabel(s.baggage))));
  if (labels.size > 1) return "Baggage varies by flight";
  return [...labels][0] ?? "Baggage not specified";
}

/** The airlines whose flights the traveller is on, in order. Can differ from `offer.owner`, the airline selling the fare. */
export const offerAirlines = (offer: FlightOffer): string[] => [
  ...new Set(offer.slices.flatMap((slice) => slice.segments.map((s) => s.marketing.name ?? s.marketing.iata)).filter((name): name is string => Boolean(name))),
];

/** The selling airline, when it isn't one of the airlines flown (e.g. Hahn Air ticketing a Kam Air flight). */
export function soldByOther(offer: FlightOffer): string | null {
  const seller = offer.owner.name ?? offer.owner.iata;
  return seller && !offerAirlines(offer).includes(seller) ? seller : null;
}

/** Changes of plane plus technical stops within one slice. */
export const sliceStops = (segments: OfferSegment[]) =>
  segments.length - 1 + segments.reduce((n, s) => n + s.technicalStops, 0);
