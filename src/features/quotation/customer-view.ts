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

export interface CustomerSegment {
  title: string;
  flight: string | null;
  from: { code: string | null; name: string | null; date: string | null; time: string | null };
  to: { code: string | null; name: string | null; date: string | null; time: string | null };
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

const place = (code: string | null, name: string | null) => code ?? name ?? "?";

function toCustomerSegment(s: FlightSegment, index: number): CustomerSegment {
  // Show the code only when there's no name and the flight number doesn't already start with it.
  const codeInFlightNumber = Boolean(s.airlineCode && s.flightNumber?.toUpperCase().startsWith(s.airlineCode));
  const airline = s.airlineName ?? (codeInFlightNumber ? null : s.airlineCode);
  const details = [
    s.cabin,
    s.duration && `Duration ${s.duration}`,
    s.stops !== null && (s.stops === 0 ? "Non-stop" : `${s.stops} stop${s.stops > 1 ? "s" : ""}`),
    s.baggage && `Baggage: ${s.baggage}`,
  ].filter((v): v is string => Boolean(v));

  return {
    title: `Flight ${index + 1}`,
    flight: [airline, s.flightNumber].filter(Boolean).join(" · ") || null,
    from: { code: s.originCode, name: s.originName, date: formatIsoDate(s.departureDate), time: s.departureTime },
    to: { code: s.destinationCode, name: s.destinationName, date: formatIsoDate(s.arrivalDate), time: s.arrivalTime },
    details,
  };
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

  const stops = q.segments.map((s) => place(s.originCode, s.originName));
  const last = q.segments.at(-1);
  if (last) stops.push(place(last.destinationCode, last.destinationName));

  return {
    watermark: watermarkFor(q),
    quoteNumber: q.quoteNumber,
    issuedOn: formatDate(now),
    validUntil: formatDate(validUntil),
    customerName: q.customer.name,
    travellers: describeTravellers(q.passengers),
    segments: q.segments.map(toCustomerSegment),
    // En dash, not an arrow: the PDF's built-in font has no arrow glyph.
    routeSummary: stops.filter((s, i) => s !== stops[i - 1]).join(" – "),
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
      (s) => `• ${s.from.date ?? ""} ${s.from.time ?? ""} ${s.from.code ?? s.from.name ?? ""} → ${s.to.code ?? s.to.name ?? ""}${s.flight ? ` (${s.flight})` : ""}`.replace(/\s+/g, " "),
    ),
    view.travellers ? `Travellers: ${view.travellers}` : null,
    `Total price: ${view.totalPrice}`,
    "",
    `This quotation is valid until ${view.validUntil}. Fares are subject to availability until tickets are issued.`,
    "",
    `Kind regards,`,
    brand.name,
    brand.contact.phone,
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}
