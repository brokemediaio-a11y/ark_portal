import { brand } from "@/config/brand";
import { calculatePrice, formatMoney } from "./pricing";
import type { FlightSegment, Passengers, Quotation } from "./schema";

/**
 * The customer-facing view of a quotation. The PDF, email and WhatsApp text are
 * built ONLY from this object, so internal values (supplier price, markup) can
 * never leak into what the customer sees.
 */
export interface CustomerQuote {
  /** Printed across the PDF when the data isn't real (demo extraction or provider test mode). */
  watermark: string | null;
  quoteNumber: string;
  issuedOn: string;
  validUntil: string;
  customerName: string | null;
  travellers: string | null;
  segments: CustomerSegment[];
  routeSummary: string;
  totalPrice: string;
  notes: string | null;
  fareConditions: string | null;
  terms: string[];
}

export interface CustomerPoint {
  code: string | null;
  name: string | null;
  date: string | null;
  time: string | null;
  terminal: string | null;
}

export interface CustomerSegment {
  title: string;
  flight: string | null;
  airlineName: string | null;
  /** Two-character airline code, used to find the logo. */
  airlineCode: string | null;
  flightNumber: string | null;
  duration: string | null;
  stops: string | null;
  from: CustomerPoint;
  to: CustomerPoint;
  details: string[];
}

/** "2026-12-10" → "Thu, 10 Dec 2026" without any timezone shifting. */
export function formatIsoDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [y, m, d] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date);

function describeTravellers(p: Passengers): string | null {
  const parts = [
    [p.adults, "adult"],
    [p.children, "child"],
    [p.infants, "infant"],
  ]
    .filter(([n]) => typeof n === "number" && n > 0)
    .map(([n, label]) => `${n} ${label}${n === 1 ? "" : label === "child" ? "ren" : "s"}`);
  return parts.length ? parts.join(", ") : null;
}

/** Code, or the place name up to its first comma ("STOCKHOLM ARLANDA, SWEDEN" → "STOCKHOLM ARLANDA"). */
const place = (code: string | null, name: string | null) => code ?? name?.split(",")[0].trim() ?? "?";

/** "9919" printed with carrier "RQ" reads as "RQ 9919". */
export const flightLabel = (s: Pick<FlightSegment, "airlineCode" | "flightNumber">) =>
  s.flightNumber && /^\d+$/.test(s.flightNumber.trim()) && s.airlineCode ? `${s.airlineCode} ${s.flightNumber.trim()}` : s.flightNumber;

/** The airline's code, read from the flight number ("TK 1954") when it wasn't stated separately. */
export function airlineCodeOf(s: Pick<FlightSegment, "airlineCode" | "flightNumber">): string | null {
  if (s.airlineCode && /^[A-Z0-9]{2}$/.test(s.airlineCode)) return s.airlineCode;
  const code = /^\s*([A-Za-z0-9]{2})[\s-]*\d/.exec(s.flightNumber ?? "")?.[1].toUpperCase();
  return code && /[A-Z]/.test(code) ? code : null;
}

/** One flight as the customer sees it; e-tickets add terminals and their own details. */
export function toCustomerSegment(s: FlightSegment, index: number): CustomerSegment {
  // Show the code only when there's no name and the flight number doesn't already start with it.
  const codeInFlightNumber = Boolean(s.airlineCode && s.flightNumber?.toUpperCase().startsWith(s.airlineCode));
  const airline = s.airlineName ?? (codeInFlightNumber ? null : s.airlineCode);
  const details = [s.cabin, s.baggage && `Baggage: ${s.baggage}`].filter((v): v is string => Boolean(v));

  return {
    title: `Flight ${index + 1}`,
    flight: [airline, flightLabel(s)].filter(Boolean).join(" · ") || null,
    airlineName: s.airlineName,
    airlineCode: airlineCodeOf(s),
    flightNumber: flightLabel(s),
    duration: s.duration,
    stops: s.stops === null ? null : s.stops === 0 ? "Non-stop" : `${s.stops} stop${s.stops > 1 ? "s" : ""}`,
    from: { code: s.originCode, name: s.originName, date: formatIsoDate(s.departureDate), time: s.departureTime, terminal: null },
    to: { code: s.destinationCode, name: s.destinationName, date: formatIsoDate(s.arrivalDate), time: s.arrivalTime, terminal: null },
    details,
  };
}

/** "AMS – IST – KBL". En dash, not an arrow: the PDF's built-in font has no arrow glyph. */
export function routeSummaryOf(segments: FlightSegment[]): string {
  const stops = segments.map((s) => place(s.originCode, s.originName));
  const last = segments.at(-1);
  if (last) stops.push(place(last.destinationCode, last.destinationName));
  return stops.filter((s, i) => s !== stops[i - 1]).join(" – ");
}

export function watermarkFor(q: Quotation): string | null {
  if (q.sourceType === "demo") return "DEMO DATA — NOT A REAL QUOTATION";
  if (q.providerSnapshot && !q.providerSnapshot.liveMode) return "TEST MODE — NOT A REAL FARE";
  return null;
}

export function buildCustomerQuote(q: Quotation, now = new Date(q.createdAt)): CustomerQuote {
  const price = calculatePrice(q.sourceTotal, q.markup, q.currency);
  const validUntil = new Date(now);
  validUntil.setDate(validUntil.getDate() + brand.quoteValidityDays);


  return {
    watermark: watermarkFor(q),
    quoteNumber: q.quoteNumber,
    issuedOn: formatDate(now),
    validUntil: formatDate(validUntil),
    customerName: q.customer.name,
    travellers: describeTravellers(q.passengers),
    segments: q.segments.map(toCustomerSegment),
    routeSummary: routeSummaryOf(q.segments),
    totalPrice: formatMoney(price?.sellingTotal ?? null, q.currency),
    notes: q.notes,
    fareConditions: q.fareConditions,
    terms: (q.termsText ?? "").split("\n").map((t) => t.trim()).filter(Boolean),
  };
}

/** Short plain-text message for email / WhatsApp handoff. */
export function buildShareMessage(view: CustomerQuote): string {
  const lines = [
    `Dear ${view.customerName ?? "Customer"},`,
    "",
    `Please find your flight quotation ${view.quoteNumber} from ${brand.name}.`,
    "",
    `Route: ${view.routeSummary}`,
    ...view.segments.map(
      (s) => `• ${s.from.date ?? ""} ${s.from.time ?? ""} ${s.from.code ?? s.from.name ?? ""} → ${s.to.code ?? s.to.name ?? ""}${s.flight ? ` (${s.flight})` : ""}${s.duration ? `, ${s.duration}` : ""}`.replace(/\s+/g, " "),
    ),
    view.travellers ? `Travellers: ${view.travellers}` : null,
    `Total price: ${view.totalPrice}`,
    "",
    `This quotation is valid until ${view.validUntil}. Fares are subject to availability until tickets are issued.`,
    "",
    `Kind regards,`,
    brand.name,
    ...brand.contact.phones,
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}
