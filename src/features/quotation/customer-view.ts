import { brand } from "@/config/brand";
import { calculatePrice, formatMoney } from "./pricing";
import type { FlightSegment, Passengers, Quotation } from "./schema";
import { connectionBetween, flightDuration, type FlightConnection } from "./journey-timing";

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
  customerName: string | null;
  travellers: string | null;
  segments: CustomerSegment[];
  routeSummary: string;
  /** One bar when everyone pays one price; with children or infants, one for the adults and one for them. */
  prices: CustomerPrice[];
  notes: string | null;
  /** Dari terms, printed beside the English ones. */
  termsDari: string[];
  fareConditions: string | null;
  terms: string[];
}

export interface CustomerPrice {
  /** "Total price", "Adults", "Children & infants" */
  label: string;
  /** Who it is for, e.g. "2 adults" or "1 child, 1 infant"; null on a single total. */
  detail: string | null;
  /** The children's and infants' names, e.g. "Ali Khan (child)". */
  names: string[];
  amount: string;
}

export interface CustomerPoint {
  code: string | null;
  name: string | null;
  date: string | null;
  time: string | null;
  terminal: string | null;
}

export interface CustomerSegment {
  connectionBefore?: FlightConnection | null;
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
  /** The flight card's "Baggage" block; null when neither allowance is known. */
  baggage: { handCarry: string | null; checkIn: string | null } | null;
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

const count = (n: number | null) => (typeof n === "number" && n > 0 ? n : 0);

/** Whether the quotation has children or infants, who are then priced apart from the adults. */
export const hasYoungTravellers = (p: Passengers) => count(p.children) + count(p.infants) > 0;

/** Every child and infant the counts call for, with the name staff entered for them (or null). */
export function youngTravellerNames(q: Pick<Quotation, "passengers" | "childNames" | "infantNames">): { label: string; type: "child" | "infant"; name: string | null }[] {
  const list = (n: number, names: (string | null)[], type: "child" | "infant") =>
    Array.from({ length: n }, (_, i) => ({ label: `${type === "child" ? "Child" : "Infant"} ${i + 1}`, type, name: names[i]?.trim() || null }));
  return [...list(count(q.passengers.children), q.childNames, "child"), ...list(count(q.passengers.infants), q.infantNames, "infant")];
}

/** "Children & infants", "Children", "Infant"… after who is actually travelling. */
function youngLabel(p: Passengers): string {
  const children = count(p.children);
  const infants = count(p.infants);
  if (children && infants) return "Children & infants";
  if (children) return children === 1 ? "Child" : "Children";
  return infants === 1 ? "Infant" : "Infants";
}

function pricesOf(q: Quotation): CustomerPrice[] {
  const adults = formatMoney(calculatePrice(q.sourceTotal, q.markup, q.currency)?.sellingTotal ?? null, q.currency);
  if (!hasYoungTravellers(q.passengers)) return [{ label: "Total price", detail: null, names: [], amount: adults }];
  const young = formatMoney(calculatePrice(q.youngPricing.sourceTotal, q.youngPricing.markup, q.currency)?.sellingTotal ?? null, q.currency);
  return [
    { label: count(q.passengers.adults) === 1 ? "Adult" : "Adults", detail: describeTravellers({ adults: q.passengers.adults, children: null, infants: null }), names: [], amount: adults },
    {
      label: youngLabel(q.passengers),
      detail: describeTravellers({ adults: null, children: q.passengers.children, infants: q.passengers.infants }),
      names: youngTravellerNames(q).flatMap((t) => (t.name ? [`${t.name} (${t.type})`] : [])),
      amount: young,
    },
  ];
}

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
export function toCustomerSegment(s: FlightSegment, index: number, previous?: FlightSegment): CustomerSegment {
  // Show the code only when there's no name and the flight number doesn't already start with it.
  const codeInFlightNumber = Boolean(s.airlineCode && s.flightNumber?.toUpperCase().startsWith(s.airlineCode));
  const airline = s.airlineName ?? (codeInFlightNumber ? null : s.airlineCode);
  const details = [s.cabin].filter((v): v is string => Boolean(v));

  return {
    connectionBefore: previous ? connectionBetween(previous, s) : null,
    title: `Flight ${index + 1}`,
    flight: [airline, flightLabel(s)].filter(Boolean).join(" · ") || null,
    airlineName: s.airlineName,
    airlineCode: airlineCodeOf(s),
    flightNumber: flightLabel(s),
    duration: flightDuration(s),
    stops: s.stops === null ? null : s.stops === 0 ? "Non-stop" : `${s.stops} stop${s.stops > 1 ? "s" : ""}`,
    from: { code: s.originCode, name: s.originName, date: formatIsoDate(s.departureDate), time: s.departureTime, terminal: null },
    to: { code: s.destinationCode, name: s.destinationName, date: formatIsoDate(s.arrivalDate), time: s.arrivalTime, terminal: null },
    details,
    baggage: s.handCarry || s.checkIn ? { handCarry: s.handCarry, checkIn: s.checkIn } : null,
  };
}

/** One note per line, blank lines dropped. */
export const noteLines = (text: string | null) => (text ?? "").split("\n").map((t) => t.trim()).filter(Boolean);

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

  return {
    watermark: watermarkFor(q),
    quoteNumber: q.quoteNumber,
    issuedOn: formatDate(now),
    customerName: q.customer.name,
    travellers: describeTravellers(q.passengers),
    segments: q.segments.map((segment, index) => toCustomerSegment(segment, index, q.segments[index - 1])),
    routeSummary: routeSummaryOf(q.segments),
    prices: pricesOf(q),
    notes: q.notes,
    fareConditions: q.fareConditions,
    terms: noteLines(q.termsText),
    termsDari: noteLines(q.termsTextDari),
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
    ...view.prices.map((p) => `${p.label === "Total price" ? "Total price" : `Price for ${p.label.toLowerCase()}${p.names.length ? ` (${p.names.join(", ")})` : ""}`}: ${p.amount}`),
    "",
    `${brand.fareNotice}. Fares are subject to availability until tickets are issued.`,
    "",
    `Kind regards,`,
    brand.name,
    ...brand.contact.phones,
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}
