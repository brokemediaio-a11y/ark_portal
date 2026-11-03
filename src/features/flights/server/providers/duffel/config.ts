import "server-only";
import { FlightProviderError } from "../types";

export interface DuffelConfig {
  token: string;
  liveMode: boolean;
  baseUrl: string;
}

/**
 * Reads Duffel settings from the environment and refuses unsafe combinations:
 * DUFFEL_ENV=test must use a test token (duffel_test_…), and live mode needs an
 * explicit DUFFEL_ENV=live with a live token. The token never leaves the server.
 */
export function getDuffelConfig(env: NodeJS.ProcessEnv = process.env): DuffelConfig {
  const mode = (env.DUFFEL_ENV ?? "test").toLowerCase();
  const baseUrl = env.DUFFEL_API_BASE_URL || "https://api.duffel.com";

  if (mode === "test") {
    const token = env.DUFFEL_TEST_ACCESS_TOKEN;
    if (!token) throw new FlightProviderError("not_configured", "Flight search isn't set up yet (missing Duffel test token). Please contact your administrator.", 503);
    if (!token.startsWith("duffel_test_")) {
      console.error("[duffel] DUFFEL_ENV=test but the token is not a test token — refusing to call Duffel.");
      throw new FlightProviderError("not_configured", "Flight search is misconfigured. Please contact your administrator.", 503);
    }
    return { token, liveMode: false, baseUrl };
  }

  if (mode === "live") {
    const token = env.DUFFEL_LIVE_ACCESS_TOKEN;
    if (!token?.startsWith("duffel_live_"))
      throw new FlightProviderError("not_configured", "Live flight search isn't set up correctly. Please contact your administrator.", 503);
    return { token, liveMode: true, baseUrl };
  }

  throw new FlightProviderError("not_configured", `Unknown DUFFEL_ENV "${mode}".`, 503);
}
