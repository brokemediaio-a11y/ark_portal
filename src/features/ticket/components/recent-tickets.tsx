"use client";

import Link from "next/link";
import { ArrowRight, Loader2, Ticket as TicketIcon, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { relativeTime } from "@/features/quotation/components/recent-quotations";
import { StatusBadge } from "@/features/quotation/components/status-badge";
import { routeSummaryOf } from "@/features/quotation/customer-view";
import { ticketStore, useTicketMap } from "../storage";

export function RecentTickets({ limit }: { limit?: number } = {}) {
  const map = useTicketMap();
  const all = map ? ticketStore.list() : null;
  const tickets = all && limit ? all.slice(0, limit) : all;

  const remove = (id: string, label: string) => {
    if (window.confirm(`Delete e-ticket ${label}? This can't be undone.`)) ticketStore.remove(id);
  };

  return (
    <Card>
      <CardHeader
        icon={TicketIcon}
        title={limit ? "Your latest e-tickets" : "All e-tickets"}
        description="Saved on this computer only. Click one to edit it or download it again."
        actions={limit && all && all.length > limit ? <Link href="/tickets" className="text-sm font-semibold text-brand hover:underline">See all {all.length}</Link> : undefined}
      />
      {!tickets ? (
        <div className="grid place-items-center py-12 text-ink-muted"><Loader2 className="animate-spin" aria-label="Loading" /></div>
      ) : tickets.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-ink-muted">
          No e-tickets yet. Upload a supplier&apos;s ticket to turn it into an Ark Travelers e-ticket.
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {tickets.map((t) => {
            const route = routeSummaryOf(t.segments);
            const label = t.bookingReference ?? t.ticketRef;
            const travellers = t.passengers.map((p) => p.name).filter(Boolean);
            return (
              <li key={t.id} className="group flex items-center gap-2 pr-3 hover:bg-surface/70">
                <Link href={`/tickets/${t.id}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                      <span className="truncate">{/[A-Za-z]/.test(route) ? route : "Untitled e-ticket"}</span>
                      <StatusBadge status={t.status} />
                      {t.sourceType === "demo" && <Badge tone="danger">DEMO</Badge>}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-ink-muted">
                      PNR {label} · {travellers.length ? `${travellers[0]}${travellers.length > 1 ? ` +${travellers.length - 1}` : ""}` : "No passenger"} · updated {relativeTime(t.updatedAt)}
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-ink-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
                <Button variant="danger" size="sm" icon={Trash2} aria-label={`Delete e-ticket ${label}`} title="Delete" onClick={() => remove(t.id, label)} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
