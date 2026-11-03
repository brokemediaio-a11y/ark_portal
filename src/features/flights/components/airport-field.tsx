"use client";

import { Loader2, MapPin, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { controlClasses } from "@/components/ui/form-field";
import { cn } from "@/lib/cn";
import { placeTitle } from "../format";
import type { LocationsResponse, Place } from "../schema";

const DEBOUNCE_MS = 250;

/** Second line under a place: the airport name, or which airports a city covers. */
const placeDetail = (p: Place) =>
  p.type === "city" ? `All airports${p.airports.length ? `: ${p.airports.join(", ")}` : ""}` : p.name;

interface AirportFieldProps {
  label: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  placeholder?: string;
  error?: string | null;
  autoFocus?: boolean;
}

/** Type a city, airport name or code; pick from live suggestions (keyboard friendly). */
export function AirportField({ label, value, onChange, placeholder = "City or airport", error, autoFocus }: AirportFieldProps) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // Results are stored with the query they answer, so stale results are never shown.
  const [lookup, setLookup] = useState<{ q: string; places: Place[]; error: string | null } | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const pending = trimmed.length >= 2 && lookup?.q !== trimmed;
  const results = lookup?.q === trimmed ? lookup.places : [];

  useEffect(() => {
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/flights/locations?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        const json = (await res.json()) as LocationsResponse;
        setLookup(json.ok ? { q: trimmed, places: json.places, error: null } : { q: trimmed, places: [], error: json.error });
        setActive(0);
      } catch {
        if (!controller.signal.aborted)
          setLookup({ q: trimmed, places: [], error: "Airport search is unavailable. Check your connection." });
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmed]);

  const choose = (place: Place) => {
    onChange(place);
    setQuery("");
    setOpen(false);
  };

  const showList = open && trimmed.length >= 2;
  const message = error ?? (lookup?.q === trimmed ? lookup.error : null);

  return (
    <div className="relative space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">{label}</label>

      {value ? (
        <div className={cn(controlClasses(error ? "error" : "default"), "flex h-13 items-center gap-3")}>
          <MapPin size={18} className="shrink-0 text-brand" aria-hidden />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate font-semibold">{placeTitle(value)}</p>
            <p className="truncate text-xs text-ink-muted">{placeDetail(value)}</p>
          </div>
          <button
            type="button"
            aria-label={`Change ${label.toLowerCase()}`}
            onClick={() => {
              onChange(null);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-muted hover:bg-surface hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <MapPin size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            ref={inputRef}
            id={id}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
            aria-invalid={Boolean(error) || undefined}
            autoComplete="off"
            autoFocus={autoFocus}
            value={query}
            placeholder={placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => {
              if (!showList || !results.length) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => (i + 1) % results.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => (i - 1 + results.length) % results.length);
              } else if (e.key === "Enter") {
                e.preventDefault();
                choose(results[active]);
              } else if (e.key === "Escape") setOpen(false);
            }}
            className={controlClasses(error ? "error" : "default", "h-13 pr-10 pl-10 text-base")}
          />
          {pending && <Loader2 size={16} className="absolute top-1/2 right-3.5 -translate-y-1/2 animate-spin text-ink-faint" aria-hidden />}
        </div>
      )}

      {showList && !value && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-line bg-white p-1 shadow-card"
        >
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-ink-muted">{pending ? "Searching…" : "No airports found. Try the city name or 3-letter code."}</li>
          ) : (
            results.map((place, i) => (
              <li
                key={`${place.type}-${place.iata}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(place);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2", i === active && "bg-brand-soft")}
              >
                <span className="w-11 shrink-0 rounded-md bg-surface py-1 text-center text-sm font-bold text-brand">{place.iata}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">
                    {place.type === "city" ? place.name : (place.cityName ?? place.name)}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {[placeDetail(place), place.countryCode].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </li>
            ))
          )}
        </ul>
      )}

      {message && <p className="text-xs text-danger-ink">{message}</p>}
    </div>
  );
}
