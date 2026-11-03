import { Equal, Plus } from "lucide-react";
import { formatMoney, type PriceBreakdown } from "../pricing";

/** Transparent price calculation for staff. Internal only — not shown to customers. */
export function PriceSummary({ price, currency }: { price: PriceBreakdown | null; currency: string | null }) {
  if (!price) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface p-4 text-sm text-ink-muted">
        Enter the supplier price to see the customer price.
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-brand p-4 text-white sm:p-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/75">
        <span>Supplier {formatMoney(price.sourceTotal, currency)}</span>
        <Plus size={14} aria-label="plus" />
        <span className="inline-flex items-center gap-2">
          Markup {formatMoney(price.markupAmount, currency)}
          <Equal size={14} aria-label="equals" />
        </span>
      </div>
      <p className="mt-1 text-xs tracking-wide text-white/60 uppercase">Customer pays</p>
      <p className="text-3xl font-bold tabular-nums">{formatMoney(price.sellingTotal, currency)}</p>
    </div>
  );
}
