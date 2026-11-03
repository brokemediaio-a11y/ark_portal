"use client";

import { SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/cn";
import { offerAirlines, sliceStops } from "../format";
import type { FlightOffer } from "../schema";
import { FlightOfferCard } from "./flight-offer-card";

const PAGE_SIZE = 15;

const SORTS = [
  { value: "price", label: "Cheapest" },
  { value: "duration", label: "Fastest" },
  { value: "departure", label: "Earliest" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

const STOP_FILTERS = [
  { value: "any", label: "Any stops" },
  { value: "0", label: "Direct" },
  { value: "1", label: "Up to 1 stop" },
] as const;
type StopFilter = (typeof STOP_FILTERS)[number]["value"];

const maxStops = (o: FlightOffer) => Math.max(...o.slices.map((s) => sliceStops(s.segments)));
const totalMinutes = (o: FlightOffer) => o.slices.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

const comparators: Record<Sort, (a: FlightOffer, b: FlightOffer) => number> = {
  price: (a, b) => a.totalAmount - b.totalAmount || totalMinutes(a) - totalMinutes(b),
  duration: (a, b) => totalMinutes(a) - totalMinutes(b) || a.totalAmount - b.totalAmount,
  departure: (a, b) => a.slices[0].segments[0].departingAt.localeCompare(b.slices[0].segments[0].departingAt) || a.totalAmount - b.totalAmount,
};

interface FlightResultsProps {
  offers: FlightOffer[];
  sliceLabels: string[];
  busyOfferId: string | null;
  onSelect: (offer: FlightOffer) => void;
}

export function FlightResults({ offers, sliceLabels, busyOfferId, onSelect }: FlightResultsProps) {
  const [sort, setSort] = useState<Sort>("price");
  const [stops, setStops] = useState<StopFilter>("any");
  const [airline, setAirline] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const airlines = useMemo(() => {
    const counts = new Map<string, number>();
    for (const name of offers.flatMap(offerAirlines)) counts.set(name, (counts.get(name) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [offers]);

  const filtered = useMemo(
    () =>
      offers
        .filter((o) => stops === "any" || maxStops(o) <= Number(stops))
        .filter((o) => !airline || offerAirlines(o).includes(airline))
        .sort(comparators[sort]),
    [offers, stops, airline, sort],
  );

  const resetPaging = () => setVisible(PAGE_SIZE);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink">{filtered.length}</span> of {offers.length} fares
        </p>
        <div className="flex flex-wrap gap-2">
          <SegmentedControl label="Sort by" value={sort} options={SORTS} onChange={(s) => { setSort(s); resetPaging(); }} />
          <SegmentedControl label="Stops" value={stops} options={STOP_FILTERS} onChange={(s) => { setStops(s); resetPaging(); }} />
        </div>
      </div>

      {airlines.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by airline">
          <Chip active={airline === null} onClick={() => { setAirline(null); resetPaging(); }} label={`All airlines (${offers.length})`} />
          {airlines.map(([name, count]) => (
            <Chip key={name} active={airline === name} onClick={() => { setAirline(airline === name ? null : name); resetPaging(); }} label={`${name} (${count})`} />
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-ink-muted">No fares match these filters.</p>
      ) : (
        <div className="space-y-3">
          {filtered.slice(0, visible).map((offer) => (
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

      {filtered.length > visible && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Show more fares ({filtered.length - visible} more)
          </Button>
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
        active ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-muted hover:border-brand/40 hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}
