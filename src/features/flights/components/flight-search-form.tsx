"use client";

import { ArrowLeftRight, Plus, Search, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/form-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { localToday } from "@/lib/dates";
import { useToday } from "@/lib/use-today";
import { MAX_PASSENGERS, MAX_SLICES, type CabinClass, type FlightSearchRequest, type Place } from "../schema";
import { AirportField } from "./airport-field";
import { FlightPath } from "./flight-path";
import { PassengerPicker, type PassengerValues } from "./passenger-picker";

export type TripType = "return" | "oneway" | "multicity";

export interface LegValues {
  origin: Place | null;
  destination: Place | null;
  date: string | null;
}

export interface FlightSearchFormValues {
  tripType: TripType;
  /** Return trips use legs[0] for the outbound and `returnDate` for the way back. */
  legs: LegValues[];
  returnDate: string | null;
  passengers: PassengerValues;
  cabinClass: CabinClass;
  maxConnections: 0 | 1 | 2 | null;
}

const TRIP_TYPES = [
  { value: "return", label: "Return" },
  { value: "oneway", label: "One way" },
  { value: "multicity", label: "Multi-city" },
] as const;

const CABINS = [
  { value: "economy", label: "Economy" },
  { value: "premium_economy", label: "Premium economy" },
  { value: "business", label: "Business" },
  { value: "first", label: "First" },
] as const;

const STOPS = [
  { value: "any", label: "Any number of stops" },
  { value: "0", label: "Direct flights only" },
  { value: "1", label: "Up to 1 stop" },
  { value: "2", label: "Up to 2 stops" },
] as const;

const emptyLeg = (origin: Place | null = null): LegValues => ({ origin, destination: null, date: null });

type Errors = Record<string, string>;

/** "8 nights" between two dates, or "Same day"; empty until both are chosen and in order. */
function tripLengthLabel(departure: string | null, back: string | null): string {
  if (!departure || !back) return "";
  const nights = Math.round((Date.parse(`${back}T00:00:00Z`) - Date.parse(`${departure}T00:00:00Z`)) / 86_400_000);
  if (nights < 0) return "";
  return nights === 0 ? "Same day" : `${nights} night${nights === 1 ? "" : "s"}`;
}

function validate(v: FlightSearchFormValues, today: string): Errors {
  const errors: Errors = {};
  const legs = v.tripType === "multicity" ? v.legs : v.legs.slice(0, 1);
  legs.forEach((leg, i) => {
    if (!leg.origin) errors[`legs.${i}.origin`] = "Choose where this flight departs from.";
    if (!leg.destination) errors[`legs.${i}.destination`] = "Choose where this flight goes to.";
    if (leg.origin && leg.destination && leg.origin.iata === leg.destination.iata)
      errors[`legs.${i}.destination`] = "Must be different from the departure.";
    if (!leg.date) errors[`legs.${i}.date`] = "Choose a date.";
    else if (leg.date < today) errors[`legs.${i}.date`] = "This date is in the past.";
    else if (i > 0 && legs[i - 1].date && leg.date < legs[i - 1].date!) errors[`legs.${i}.date`] = "Must be on or after the previous flight.";
  });
  if (v.tripType === "return") {
    if (!v.returnDate) errors.returnDate = "Choose a return date.";
    else if (v.legs[0].date && v.returnDate < v.legs[0].date) errors.returnDate = "Must be on or after the departure date.";
  }
  const p = v.passengers;
  const travellers = p.adults + p.childAges.length + p.infantAges.length;
  if (travellers === 0) errors.passengers = "Add at least one traveller.";
  else if (travellers > MAX_PASSENGERS) errors.passengers = `At most ${MAX_PASSENGERS} travellers per search.`;
  else if (p.infantAges.length > p.adults) errors.passengers = "Each infant needs an adult to sit with.";
  return errors;
}

function toRequest(v: FlightSearchFormValues): FlightSearchRequest {
  const legs = v.tripType === "multicity" ? v.legs : v.legs.slice(0, 1);
  const slices = legs.map((l) => ({ origin: l.origin!.iata, destination: l.destination!.iata, departureDate: l.date! }));
  if (v.tripType === "return") slices.push({ origin: slices[0].destination, destination: slices[0].origin, departureDate: v.returnDate! });
  return { slices, passengers: v.passengers, cabinClass: v.cabinClass, maxConnections: v.maxConnections };
}

/** Maps server field paths (slices.1.departureDate) onto form fields. */
function serverFieldKey(field: string | undefined, tripType: TripType): string | null {
  const m = /^slices\.(\d+)\.(origin|destination|departureDate)$/.exec(field ?? "");
  if (!m) return field?.startsWith("passengers") ? "passengers" : null;
  const index = Number(m[1]);
  const part = m[2] === "departureDate" ? "date" : m[2];
  if (tripType === "return" && index === 1) return part === "date" ? "returnDate" : `legs.0.${part === "origin" ? "destination" : "origin"}`;
  return `legs.${index}.${part}`;
}

interface FlightSearchFormProps {
  initial: FlightSearchFormValues;
  loading: boolean;
  serverError?: { field?: string; message: string } | null;
  onSearch: (request: FlightSearchRequest, values: FlightSearchFormValues) => void;
}

export function FlightSearchForm({ initial, loading, serverError, onSearch }: FlightSearchFormProps) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const today = useToday();

  const update = (patch: Partial<FlightSearchFormValues>, clear: string[] = []) => {
    setValues((v) => ({ ...v, ...patch }));
    if (clear.length) setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !clear.includes(k))));
  };
  const updateLeg = (i: number, patch: Partial<LegValues>) =>
    update(
      { legs: values.legs.map((l, j) => (j === i ? { ...l, ...patch } : l)) },
      Object.keys(patch).map((k) => `legs.${i}.${k}`),
    );

  const setTripType = (tripType: TripType) => {
    const legs =
      tripType === "multicity" && values.legs.length < 2 ? [values.legs[0], emptyLeg(values.legs[0].destination)] : values.legs;
    update({ tripType, legs }, Object.keys(errors));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found = validate(values, localToday());
    setErrors(found);
    if (Object.keys(found).length) return;
    onSearch(toRequest(values), values);
  };

  const serverKey = serverError ? serverFieldKey(serverError.field, values.tripType) : null;
  const errorFor = (key: string) => errors[key] ?? (serverKey === key ? serverError!.message : null);
  const visibleLegs = values.tripType === "multicity" ? values.legs : values.legs.slice(0, 1);

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <SegmentedControl label="Trip type" value={values.tripType} options={TRIP_TYPES} onChange={setTripType} />

      <div className="space-y-4">
        {visibleLegs.map((leg, i) => (
          <div key={i} className="space-y-2">
            {values.tripType === "multicity" && (
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink-muted">Flight {i + 1}</p>
                {values.legs.length > 2 && (
                  <Button variant="danger" size="sm" icon={Trash2} onClick={() => update({ legs: values.legs.filter((_, j) => j !== i) })}>
                    Remove
                  </Button>
                )}
              </div>
            )}
            <div className="grid items-start gap-3 xl:grid-cols-[1fr_auto_1fr]">
              <AirportField label="From" value={leg.origin} onChange={(p) => updateLeg(i, { origin: p })} error={errorFor(`legs.${i}.origin`)} autoFocus={i === 0 && !leg.origin} />
              <button
                type="button"
                onClick={() => updateLeg(i, { origin: leg.destination, destination: leg.origin })}
                className="mx-auto grid size-10 cursor-pointer place-items-center rounded-full border border-line bg-white text-ink-muted transition-colors hover:border-brand hover:text-brand xl:mt-8"
                aria-label="Swap from and to"
                title="Swap"
              >
                <ArrowLeftRight size={18} />
              </button>
              <AirportField label="To" value={leg.destination} onChange={(p) => updateLeg(i, { destination: p })} error={errorFor(`legs.${i}.destination`)} />
            </div>
            <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(6rem,14rem)_minmax(0,1fr)] lg:max-w-3xl">
              <TextField
                label={values.tripType === "multicity" ? "Date" : "Departure"}
                type="date"
                value={leg.date}
                min={(i > 0 ? values.legs[i - 1].date : null) ?? today ?? undefined}
                error={errorFor(`legs.${i}.date`)}
                onChange={(d) => updateLeg(i, { date: d })}
              />
              {values.tripType === "return" ? (
                <>
                  <div className="hidden pt-6 text-center sm:block">
                    <p className="h-4 text-xs font-medium text-ink-muted">{tripLengthLabel(leg.date, values.returnDate)}</p>
                    <FlightPath className="flight-path-live" />
                  </div>
                  <TextField label="Return" type="date" value={values.returnDate} min={leg.date ?? today ?? undefined} error={errorFor("returnDate")} onChange={(d) => update({ returnDate: d }, ["returnDate"])} />
                </>
              ) : (
                <div className="hidden pt-6 sm:block">
                  <p className="h-4" />
                  <FlightPath className="flight-path-live" />
                </div>
              )}
            </div>
          </div>
        ))}

        {values.tripType === "multicity" && values.legs.length < MAX_SLICES && (
          <Button variant="secondary" icon={Plus} onClick={() => update({ legs: [...values.legs, emptyLeg(values.legs.at(-1)?.destination ?? null)] })}>
            Add another flight
          </Button>
        )}
      </div>

      <PassengerPicker value={values.passengers} onChange={(passengers) => update({ passengers }, ["passengers"])} error={errorFor("passengers")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-xl">
        <SelectField label="Cabin" value={values.cabinClass} options={CABINS} onChange={(c) => update({ cabinClass: c ?? "economy" })} placeholder="Economy" />
        <SelectField
          label="Stops"
          value={values.maxConnections === null ? "any" : String(values.maxConnections) as "0" | "1" | "2"}
          options={STOPS}
          onChange={(s) => update({ maxConnections: !s || s === "any" ? null : (Number(s) as 0 | 1 | 2) })}
          placeholder="Any number of stops"
        />
      </div>

      <Button type="submit" size="lg" icon={Search} loading={loading} className="w-full sm:w-auto">
        {loading ? "Searching airlines…" : "Search flights"}
      </Button>
    </form>
  );
}

export const INITIAL_SEARCH_VALUES: FlightSearchFormValues = {
  tripType: "return",
  legs: [emptyLeg()],
  returnDate: null,
  passengers: { adults: 1, childAges: [], infantAges: [] },
  cabinClass: "economy",
  maxConnections: null,
};
