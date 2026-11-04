/**
 * Ark Travelers branding and customer-facing copy.
 *
 * Everything in this file is a PLACEHOLDER until Ark Travelers supplies
 * approved assets and wording (see docs/ark_travelers_project_initiation.md §14).
 * Update the values here — no other file needs to change.
 */
export const brand = {
  name: "Ark Travelers",
  tagline: "Your journey, our priority",
  /** Path under /public to a PNG/JPG logo, or null to use the text mark. */
  logoPath: "/brand/ark-logo-navy.png" as string | null,
  colors: {
    primary: "#1F3043",
    accent: "#D08A2E",
    muted: "#526170",
    border: "#D9E0E7",
    surface: "#F1F4F6",
  },
  contact: {
    phone: "+00 000 0000000",
    email: "info@arktravelers.example",
    website: "www.arktravelers.example",
    address: "Office address to be confirmed",
  },
  /** Number of days a quotation is shown as valid. Placeholder policy. */
  quoteValidityDays: 3,
  quoteNumberPrefix: "ARK",
  defaultTerms: [
    "Fares are subject to availability and may change until tickets are issued.",
    "This quotation is not a booking or reservation.",
    "Final terms and conditions to be confirmed by Ark Travelers.",
  ].join("\n"),
} as const;
