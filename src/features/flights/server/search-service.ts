import "server-only";
import { flightSearchRequestSchema, type FlightSearchRequest } from "../schema";
import { FlightProviderError } from "./providers";

const MAX_DAYS_AHEAD = 360;

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Validates a raw request body; throws a FlightProviderError naming the offending field. */
export function parseSearchRequest(body: unknown, today: string): FlightSearchRequest {
  const parsed = flightSearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new FlightProviderError("invalid_request", issue?.message ?? "Please check the search details.", 400, issue?.path.join("."));
  }
  const r = parsed.data;
  r.slices.forEach((s, i) => {
    if (s.departureDate < today)
      throw new FlightProviderError("invalid_request", "This date is in the past.", 400, `slices.${i}.departureDate`);
    if (daysBetween(today, s.departureDate) > MAX_DAYS_AHEAD)
      throw new FlightProviderError("invalid_request", "Airlines only sell flights up to about a year ahead.", 400, `slices.${i}.departureDate`);
  });
  return r;
}
