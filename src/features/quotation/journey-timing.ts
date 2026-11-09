import airportTimezones from "@/config/airport-timezones.json";
import type { FlightSegment } from "./schema";

const zones: Record<string, string> = airportTimezones;
const formatters = new Map<string, Intl.DateTimeFormat>();

function localStamp(date: string | null, time: string | null): number | null {
  if (!date || !time || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const stamp = Date.parse(`${date}T${time}:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 16) === `${date}T${time}` ? stamp : null;
}

/** Resolve an airport-local timestamp only when it identifies one UTC instant. */
export function airportInstant(code: string | null, date: string | null, time: string | null): number | null {
  const wall = localStamp(date, time);
  const zone = code ? zones[code.toUpperCase()] : null;
  if (wall === null || !zone) return null;
  try {
    let formatter = formatters.get(zone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat("en-GB", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
      formatters.set(zone, formatter);
    }
    const wallAt = (instant: number) => {
      const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
      return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    };
    // Probe both sides of offset changes. Ambiguous DST folds and missing DST hours
    // must not silently choose a duration; staff can enter the printed duration.
    const offsets = new Set([-36, -12, 0, 12, 36].map(hours => { const probe = wall + hours * 3600_000; return wallAt(probe) - probe; }));
    const matches = [...offsets].map(offset => wall - offset).filter(instant => wallAt(instant) === wall);
    return matches.length === 1 ? matches[0] : null;
  } catch { return null; }
}

export function elapsedLabel(minutes: number): string {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes % 1440 / 60);
  const remainder = minutes % 60;
  return [days ? `${days}d` : "", hours ? `${hours}h` : "", remainder ? `${remainder}m` : ""].filter(Boolean).join(" ") || "0m";
}

/** A printed/provider duration always wins. Airport-local clocks cannot be subtracted directly. */
export function flightDuration(segment: FlightSegment): string | null {
  if (segment.duration?.trim()) return segment.duration;
  const departure = airportInstant(segment.originCode, segment.departureDate, segment.departureTime);
  const arrival = airportInstant(segment.destinationCode, segment.arrivalDate, segment.arrivalTime);
  if (departure === null || arrival === null) return null;
  const minutes = Math.round((arrival - departure) / 60_000);
  return minutes > 0 && minutes <= 48 * 60 ? elapsedLabel(minutes) : null;
}

export interface FlightConnection {
  kind: "layover" | "stay" | "transfer" | "unknown" | "invalid";
  location: string | null;
  duration: string | null;
}

export function connectionBetween(previous: FlightSegment, next: FlightSegment): FlightConnection {
  const code = previous.destinationCode;
  const name = previous.destinationName;
  const location = name && code ? `${name} (${code})` : name || code;
  if (!code || !next.originCode) return { kind: "unknown", location: null, duration: null };
  if (code !== next.originCode) return { kind: "transfer", location: `${code} – ${next.originCode}`, duration: null };
  const arrival = airportInstant(code, previous.arrivalDate, previous.arrivalTime);
  const departure = airportInstant(code, next.departureDate, next.departureTime);
  if (arrival === null || departure === null) return { kind: "unknown", location, duration: null };
  const minutes = Math.round((departure - arrival) / 60_000);
  if (minutes <= 0) return { kind: "invalid", location, duration: null };
  return { kind: minutes >= 1440 ? "stay" : "layover", location, duration: elapsedLabel(minutes) };
}
