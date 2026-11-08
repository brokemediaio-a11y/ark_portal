"use client";

import Link from "next/link";
import { ArrowRight, FileStack, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { buildCustomerQuote } from "../customer-view";
import { quotationStore, useQuotationMap } from "../storage";
import { StatusBadge } from "./status-badge";

export const relativeTime = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (minutes < 60) return rtf.format(-minutes, "minute");
  if (minutes < 60 * 24) return rtf.format(-Math.round(minutes / 60), "hour");
  return rtf.format(-Math.round(minutes / 60 / 24), "day");
};

export function RecentQuotations({ limit }: { limit?: number } = {}) {
  const map = useQuotationMap();
  const all = map ? quotationStore.list() : null;
  const quotations = all && limit ? all.slice(0, limit) : all;

  const remove = (id: string, quoteNumber: string) => {
    if (window.confirm(`Delete quotation ${quoteNumber}? This can't be undone.`)) quotationStore.remove(id);
  };

  return (
    <Card>
      <CardHeader icon={FileStack} title={limit ? "Your latest quotations" : "All quotations"} description="Saved on this computer only. Click one to carry on where you left off."
        actions={limit && all && all.length > limit ? <Link href="/quotations" className="text-sm font-semibold text-brand hover:underline">See all {all.length}</Link> : undefined} />
      {!quotations ? (
        <div className="grid place-items-center py-12 text-ink-muted"><Loader2 className="animate-spin" aria-label="Loading" /></div>
      ) : quotations.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-ink-muted">
          You haven&apos;t made any quotations yet. Upload a supplier quote or search flights to start your first.
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {quotations.map((q) => {
            const view = buildCustomerQuote(q);
            return (
              <li key={q.id} className="group flex items-center gap-2 pr-3 hover:bg-surface/70">
                <Link href={`/quotations/${q.id}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                      <span className="truncate">{/[A-Za-z]/.test(view.routeSummary) ? view.routeSummary : "Untitled quotation"}</span>
                      <StatusBadge status={q.status} />
                      {q.sourceType === "demo" && <Badge tone="danger">DEMO</Badge>}
                      {q.providerSnapshot && !q.providerSnapshot.liveMode && <Badge tone="danger">TEST MODE</Badge>}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-ink-muted">
                      {q.quoteNumber} · {q.customer.name ?? "No customer name"} · updated {relativeTime(q.updatedAt)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-ink">{view.totalPrice}</span>
                  <ArrowRight size={16} className="text-ink-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
                <Button variant="danger" size="sm" icon={Trash2} aria-label={`Delete quotation ${q.quoteNumber}`} title="Delete" onClick={() => remove(q.id, q.quoteNumber)} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
