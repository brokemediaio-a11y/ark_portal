import "server-only";
import { duffelProvider } from "./duffel";
import { FlightProviderError, type FlightProvider } from "./types";

/** Picks the flight data source from FLIGHT_PROVIDER (server-side only). */
export function getFlightProvider(env: NodeJS.ProcessEnv = process.env): FlightProvider {
  const id = (env.FLIGHT_PROVIDER ?? "duffel").toLowerCase();
  if (id === "duffel") return duffelProvider;
  throw new FlightProviderError("not_configured", `Unknown FLIGHT_PROVIDER "${id}".`, 503);
}

export { FlightProviderError } from "./types";
export type { FlightProvider, FlightSearchResult } from "./types";
