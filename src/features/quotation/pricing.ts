import type { Markup } from "./schema";

/**
 * Pricing rules (prototype — confirm with Ark Travelers):
 * - Markup applies once to the whole itinerary total, not per passenger.
 * - Percentage markup = source total × percent, rounded half-up to the
 *   currency's minor unit (e.g. cents). Fixed markup is used as entered.
 * - Selling total = source total + markup. No currency conversion ever happens.
 * All arithmetic is done in integer minor units to avoid floating-point drift.
 */

export function currencyMinorDigits(currency: string | null | undefined): number {
  if (!currency) return 2;
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

function toMinor(amount: number, digits: number): number {
  // Number.EPSILON nudge makes 1.005 → 101 instead of 100.
  return Math.round((amount + Number.EPSILON) * 10 ** digits);
}

function fromMinor(minor: number, digits: number): number {
  return minor / 10 ** digits;
}

export interface PriceBreakdown {
  sourceTotal: number;
  markupAmount: number;
  sellingTotal: number;
}

export function calculatePrice(
  sourceTotal: number | null,
  markup: Markup,
  currency: string | null,
): PriceBreakdown | null {
  if (sourceTotal === null || !Number.isFinite(sourceTotal) || sourceTotal < 0) return null;
  const digits = currencyMinorDigits(currency);
  const sourceMinor = toMinor(sourceTotal, digits);
  const value = Math.max(0, markup.value || 0);
  const markupMinor =
    markup.type === "percentage"
      ? Math.round((sourceMinor * value) / 100 + Number.EPSILON)
      : toMinor(value, digits);

  return {
    sourceTotal: fromMinor(sourceMinor, digits),
    markupAmount: fromMinor(markupMinor, digits),
    sellingTotal: fromMinor(sourceMinor + markupMinor, digits),
  };
}

export function formatMoney(amount: number | null, currency: string | null): string {
  if (amount === null) return "—";
  if (!currency) return amount.toLocaleString("en", { minimumFractionDigits: 2 });
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
