/**
 * Ark Travelers branding and customer-facing copy, used by the portal and both PDFs.
 * Update the values here; no other file needs to change.
 */
export const brand = {
  name: "Ark Travelers",
  /** Company name printed in the middle of the PDF header. */
  legalName: "Ark Travelers AB",
  /** The company name in Persian, printed under the legal name. */
  localName: "شرکت سیاحتی سیاحان آرک",
  tagline: "Your journey, our priority",
  /** White logo with a transparent background, shown on the accent-coloured PDF header. */
  pdfLogoPath: "/brand/ark-logo-white-mark.png",
  /** Font for the Persian name; the PDF's built-in fonts have no Persian letters. */
  persianFontPath: "/fonts/Vazirmatn-Bold.ttf",
  colors: {
    /** PDF accent: header band, rules and price box. */
    primary: "#A4AFB9",
    /** Text on the accent colour and headings; the accent itself is too light for text. */
    ink: "#1A2633",
    accent: "#D08A2E",
    muted: "#526170",
    border: "#D9E0E7",
    surface: "#F1F4F6",
  },
  contact: {
    phones: ["+46 700 101 401", "+4915 25 71 11 901"],
    email: "info@arktravelers.com",
    website: "arktravelers.com",
    /** As printed on Ark Travelers' existing e-tickets. */
    address: "Kopparbacken 11, Spånga, Stockholm, Sweden",
  },
  /** Number of days a quotation is shown as valid. Placeholder policy. */
  quoteValidityDays: 3,
  quoteNumberPrefix: "ARK",
  ticketNumberPrefix: "ARK-T",
  defaultTerms: [
    "Fares are subject to availability and may change until tickets are issued.",
    "This quotation is not a booking or reservation.",
    "Final terms and conditions to be confirmed by Ark Travelers.",
  ].join("\n"),
  /** Printed at the end of every e-ticket. Placeholder wording until Ark Travelers approves it. */
  ticketNotes: [
    "This is your electronic ticket. Please carry a valid passport and any visas required for your journey.",
    "Check in online or at the airport counter in good time; international check-in usually closes 60 minutes before departure.",
    "Baggage allowances and fare conditions are set by the airline. Contact Ark Travelers for changes or refunds.",
  ].join("\n"),
} as const;
