import "server-only";
import type { FlightOffer, FlightSearchErrorCode, FlightSearchRequest, Place, ProviderInfo } from "../../schema";

export interface FlightSearchResult {
  offerRequestId: string;
  offers: FlightOffer[];
}

/**
 * A fare/flight data source (Duffel today). Implementations return normalized
 * data only, so nothing provider-specific reaches the UI or quotation code.
 */
export interface FlightProvider {
  readonly info: ProviderInfo;
  search(request: FlightSearchRequest, signal?: AbortSignal): Promise<FlightSearchResult>;
  /** Latest price and details for one offer (call before quoting it). */
  refreshOffer(offerId: string): Promise<FlightOffer>;
  /** Airports and cities matching a name or code. */
  searchPlaces(query: string): Promise<Place[]>;
}

/** An error whose message is safe to show to staff (never contains tokens or raw responses). */
export class FlightProviderError extends Error {
  constructor(
    public readonly code: FlightSearchErrorCode,
    message: string,
    public readonly status = 502,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "FlightProviderError";
  }
}
