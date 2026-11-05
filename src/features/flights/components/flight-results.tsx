"use client";

import { SearchX, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { formatMoney } from "@/features/quotation/pricing";
import { cn } from "@/lib/cn";
import {
  NO_FILTERS,
  TIMES_OF_DAY,
  filterOffers,
  filterOptions,
  isFiltered,
  sortOffers,
  type OfferFilters,
  type SortKey,
  type StopsFilter,
  type TimeOfDay,
} from "../results-filter";
import type { FlightOffer } from "../schema";
import { FlightOfferCard } from "./flight-offer-card";

const PAGE_SIZE = 15;

const SORTS = [
  { value: "price", label: "Cheapest" },
  { value: "duration", label: "Fastest" },
  { value: "departure", label: "Earliest" },
] as const;

const STOP_OPTIONS: readonly { value: StopsFilter; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "0", label: "Direct" },
  { value: "1", label: "Up to 1 stop" },
  { value: "2", label: "Up to 2 stops" },
];

const toggled = <T,>(list: readonly T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

interface FlightResultsProps {
  offers: FlightOffer[];
  totalFound: number;
  sliceLabels: string[];
  busyOfferId: string | null;
  onSelect: (offer: FlightOffer) => void;
}

export function FlightResults({ offers, totalFound, sliceLabels, busyOfferId, onSelect }: FlightResultsProps) {
  const [sort, setSort] = useState<SortKey>("price");
  const [filters, setFilters] = useState<OfferFilters>(NO_FILTERS);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const options = useMemo(() => filterOptions(offers, filters), [offers, filters]);
  const shown = useMemo(() => sortOffers(filterOffers(offers, filters), sort), [offers, filters, sort]);

  const changeFilters = (patch: Partial<OfferFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setVisible(PAGE_SIZE);
  };
  const clearFilters = () => {
    setFilters(NO_FILTERS);
    setVisible(PAGE_SIZE);
  };

  if (offers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-white px-6 py-12 text-center">
        <SearchX size={32} className="text-ink-faint" />
        <p className="font-medium text-ink">No fares returned for this search</p>
        <p className="max-w-md text-sm text-ink-muted">
          The airlines connected to our flight provider had no availability for these dates and travellers. Try other dates,
          a nearby airport, a different cabin, or allow more stops. This doesn&apos;t mean no flights exist on this route.
        </p>
      </div>
    );
  }

  const currency = offers[0].totalCurrency;
  const priceFloor = Math.ceil(options.minPrice);
  const priceCeiling = Math.ceil(options.maxPrice);

  return (
    <div className="space-y-4">
      <section aria-label="Filter results" className="space-y-4 rounded-2xl border border-line bg-white p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <FilterGroup label="Stops">
            {STOP_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                label={o.label}
                count={options.stops[o.value]}
                active={filters.stops === o.value}
                onClick={() => changeFilters({ stops: o.value })}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Departure time">
            {TIMES_OF_DAY.map((t) => (
              <Chip
                key={t.value}
                label={`${t.label} ${t.hours}`}
                count={options.departure[t.value as TimeOfDay]}
                active={filters.departure.includes(t.value)}
                onClick={() => changeFilters({ departure: toggled(filters.departure, t.value) })}
              />
            ))}
          </FilterGroup>
        </div>

        {options.airlines.length > 1 && (
          <FilterGroup label="Airlines">
            {options.airlines.map((a) => (
              <Chip
                key={a.name}
                label={a.name}
                count={a.count}
                active={filters.airlines.includes(a.name)}
                onClick={() => changeFilters({ airlines: toggled(filters.airlines, a.name) })}
              />
            ))}
          </FilterGroup>
        )}

        {priceCeiling > priceFloor && (
          <div className="space-y-1.5 lg:max-w-md">
            <label htmlFor="max-price" className="flex items-baseline justify-between text-sm font-medium text-ink">
              Maximum price
              <span className="tabular-nums text-ink-muted">{filters.maxPrice === null ? "Any price" : formatMoney(filters.maxPrice, currency)}</span>
            </label>
            <input
              id="max-price"
              type="range"
              min={priceFloor}
              max={priceCeiling}
              step={1}
              value={filters.maxPrice ?? priceCeiling}
              onChange={(e) => {
                const value = Number(e.target.value);
                changeFilters({ maxPrice: value >= priceCeiling ? null : value });
              }}
              className="w-full cursor-pointer accent-brand"
            />
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted" aria-live="polite">
          Showing <span className="font-semibold text-ink">{shown.length}</span> of {offers.length} fares
          {isFiltered(filters) && (
            <button type="button" onClick={clearFilters} className="ml-2 inline-flex cursor-pointer items-center gap-1 font-medium text-brand hover:underline">
              <X size={14} aria-hidden /> Clear filters
            </button>
          )}
        </p>
        <SegmentedControl label="Sort by" value={sort} options={SORTS} onChange={(s) => { setSort(s); setVisible(PAGE_SIZE); }} />
      </div>

      {totalFound > offers.length && (
        <p className="text-xs text-ink-muted">
          The airlines returned {totalFound.toLocaleString("en-GB")} fares. These are the {offers.length} best: the cheapest of every airline and number of stops, then the cheapest overall.
          To see others, search with a specific cabin or number of stops.
        </p>
      )}

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-white p-8 text-center">
          <p className="text-sm text-ink-muted">No fares match these filters.</p>
          <Button variant="secondary" size="sm" icon={X} onClick={clearFilters}>Clear filters</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.slice(0, visible).map((offer) => (
            <FlightOfferCard
              key={offer.id}
              offer={offer}
              sliceLabels={sliceLabels}
              busy={busyOfferId === offer.id}
              disabled={busyOfferId !== null && busyOfferId !== offer.id}
              onSelect={() => onSelect(offer)}
            />
          ))}
        </div>
      )}

      {shown.length > visible && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Show more fares ({shown.length - visible} more)
          </Button>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5" role="group" aria-label={label}>
      <p className="text-sm font-medium text-ink">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** An option with how many fares it gives. An option with none can't be picked, so nothing looks broken. */
function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={count === 0 && !active}
      className={cn(
        "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        active ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-muted enabled:hover:border-brand/40 enabled:hover:text-ink",
      )}
    >
      {label} <span className={cn("tabular-nums", active ? "text-white/75" : "text-ink-faint")}>({count})</span>
    </button>
  );
}
