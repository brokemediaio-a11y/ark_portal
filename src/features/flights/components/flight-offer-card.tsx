"use client";

import { ChevronDown, Clock, Luggage, Plane, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/features/quotation/pricing";
import { cn } from "@/lib/cn";
import {
  baggageLabel,
  conditionsLabel,
  dateLabel,
  dayShiftLabel,
  flightNumberLabel,
  formatDuration,
  minutesBetween,
  offerAirlines,
  offerBaggageLabel,
  sliceStops,
  soldByOther,
  splitLocal,
  stopsLabel,
} from "../format";
import type { FlightOffer, OfferSlice } from "../schema";

interface FlightOfferCardProps {
  offer: FlightOffer;
  sliceLabels: string[];
  busy: boolean;
  disabled: boolean;
  onSelect: () => void;
}

export function FlightOfferCard({ offer, sliceLabels, busy, disabled, onSelect }: FlightOfferCardProps) {
  const [open, setOpen] = useState(false);
  const soldBy = soldByOther(offer);

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-card">
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1 space-y-4">
          {offer.slices.map((slice, i) => (
            <SliceSummary key={slice.id} slice={slice} label={sliceLabels[i] ?? `Flight ${i + 1}`} />
          ))}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-line pt-4 lg:w-56 lg:flex-col lg:items-end lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
          <div className="lg:text-right">
            <p className="text-2xl font-bold tabular-nums text-ink">{formatMoney(offer.totalAmount, offer.totalCurrency)}</p>
            <p className="text-xs text-ink-muted">Total for all travellers · {offerAirlines(offer).join(", ") || "Airline"}</p>
            {soldBy && <p className="text-xs text-ink-muted">Sold by {soldBy}</p>}
            <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted lg:justify-end">
              <Luggage size={13} aria-hidden /> {offerBaggageLabel(offer)}
            </p>
          </div>
          <Button onClick={onSelect} loading={busy} disabled={disabled} className="shrink-0">
            {busy ? "Checking price…" : "Select"}
          </Button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-center gap-1.5 border-t border-line bg-surface/60 py-2 text-sm font-medium text-brand hover:bg-surface"
      >
        {open ? "Hide flight details" : "Flight details, baggage & fare rules"}
        <ChevronDown size={16} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && <OfferDetails offer={offer} sliceLabels={sliceLabels} />}
    </article>
  );
}

function SliceSummary({ slice, label }: { slice: OfferSlice; label: string }) {
  const first = slice.segments[0];
  const last = slice.segments.at(-1)!;
  const dep = splitLocal(first.departingAt);
  const arr = splitLocal(last.arrivingAt);
  const stops = sliceStops(slice.segments);
  const via = slice.segments.slice(0, -1).map((s) => s.destination.iata);
  const airlines = [...new Set(slice.segments.map((s) => s.marketing.name ?? s.marketing.iata).filter(Boolean))];
  const shift = dayShiftLabel(dep.date, arr.date);

  return (
    <div className="grid grid-cols-[4.5rem_1fr] items-center gap-3 sm:grid-cols-[6rem_1fr]">
      <div className="text-xs leading-tight text-ink-muted">
        <p className="font-semibold text-ink">{label}</p>
        <p>{dateLabel(dep.date)}</p>
      </div>
      <div className="flex items-center gap-3">
        <div>
          <p className="text-lg font-bold tabular-nums text-ink">{dep.time}</p>
          <p className="text-xs font-medium text-ink-muted">{first.origin.iata}</p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center text-xs text-ink-muted">
          <span>{formatDuration(slice.durationMinutes) ?? ""}</span>
          <span className="my-1 flex w-full items-center">
            <span className="h-px flex-1 bg-line" />
            {via.map((code) => (
              <span key={code} className="mx-0.5 size-1.5 rounded-full bg-warning" title={`Stop in ${code}`} />
            ))}
            <Plane size={13} className="mx-1 text-accent" aria-hidden />
            <span className="h-px flex-1 bg-line" />
          </span>
          <span className={cn("font-medium", stops === 0 ? "text-success-ink" : "text-warning-ink")}>
            {stopsLabel(stops)}
            {via.length > 0 && ` via ${via.join(", ")}`}
          </span>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums text-ink">
            {arr.time}
            {shift && <sup className="ml-0.5 text-xs font-semibold text-warning-ink">{shift}</sup>}
          </p>
          <p className="text-xs font-medium text-ink-muted">{last.destination.iata}</p>
        </div>
        <p className="hidden w-32 truncate text-xs text-ink-muted md:block" title={airlines.join(", ")}>
          {airlines.join(", ")}
        </p>
      </div>
    </div>
  );
}

function OfferDetails({ offer, sliceLabels }: { offer: FlightOffer; sliceLabels: string[] }) {
  const conditions = conditionsLabel(offer.conditions);
  return (
    <div className="space-y-5 border-t border-line p-4 sm:p-5">
      {offer.slices.map((slice, i) => (
        <section key={slice.id} className="space-y-3">
          <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            {sliceLabels[i] ?? `Flight ${i + 1}`}: {slice.origin.cityName ?? slice.origin.name} → {slice.destination.cityName ?? slice.destination.name}
            {slice.fareBrand && <Badge tone="brand">{slice.fareBrand}</Badge>}
          </h4>
          <ol className="space-y-2">
            {slice.segments.map((seg, j) => {
              const dep = splitLocal(seg.departingAt);
              const arr = splitLocal(seg.arrivingAt);
              const next = slice.segments[j + 1];
              const layover = next ? minutesBetween(seg.arrivingAt, next.departingAt) : null;
              const operatedBy = seg.operating.name && seg.operating.iata !== seg.marketing.iata ? seg.operating.name : null;
              return (
                <li key={seg.id}>
                  <div className="rounded-xl border border-line p-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold text-ink">
                        {dep.time} {seg.origin.iata} → {arr.time} {seg.destination.iata}
                        {dayShiftLabel(dep.date, arr.date) && <span className="ml-1 text-xs text-warning-ink">(arrives {dateLabel(arr.date)})</span>}
                      </p>
                      <p className="text-ink-muted">
                        {[seg.marketing.name, flightNumberLabel(seg.marketing.iata, seg.marketing.flightNumber)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      {[
                        `${seg.origin.name}${seg.originTerminal ? ` (T${seg.originTerminal})` : ""} → ${seg.destination.name}${seg.destinationTerminal ? ` (T${seg.destinationTerminal})` : ""}`,
                        formatDuration(seg.durationMinutes),
                        seg.aircraft,
                        seg.cabin,
                        operatedBy && `Operated by ${operatedBy}`,
                        seg.technicalStops > 0 && `${seg.technicalStops} technical stop${seg.technicalStops > 1 ? "s" : ""}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                      <Luggage size={13} aria-hidden /> {baggageLabel(seg.baggage) ?? "Baggage allowance not provided by the airline"}
                    </p>
                  </div>
                  {layover !== null && (
                    <p className="flex items-center gap-1.5 py-1.5 pl-3 text-xs font-medium text-warning-ink">
                      <Clock size={13} aria-hidden /> {formatDuration(layover)} connection in {seg.destination.cityName ?? seg.destination.name}
                      {next && next.origin.iata !== seg.destination.iata && ` — change airport to ${next.origin.iata}`}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      <div className="grid gap-3 rounded-xl bg-surface p-3 text-xs text-ink-muted sm:grid-cols-2">
        <p className="flex items-start gap-1.5">
          <ShieldCheck size={14} className="mt-px shrink-0" aria-hidden /> {conditions ?? "Change and refund rules not provided by the airline."}
        </p>
        <p className="sm:text-right">
          {offer.baseAmount !== null && offer.taxAmount !== null
            ? `Fare ${formatMoney(offer.baseAmount, offer.totalCurrency)} + taxes ${formatMoney(offer.taxAmount, offer.totalCurrency)}`
            : "Fare/tax split not provided"}
          {offer.expiresAt && ` · Price held until ${new Date(offer.expiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`}
        </p>
      </div>
    </div>
  );
}
