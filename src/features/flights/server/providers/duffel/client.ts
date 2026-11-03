import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { FlightProviderError } from "../types";
import { getDuffelConfig } from "./config";

const DEFAULT_TIMEOUT_MS = 45_000;

const errorBodySchema = z.object({
  errors: z
    .array(
      z.object({
        code: z.string().optional(),
        type: z.string().optional(),
        title: z.string().optional(),
        message: z.string().optional(),
        source: z.object({ field: z.string().optional(), pointer: z.string().optional() }).nullish(),
      }),
    )
    .optional(),
});

/** Friendly wording for Duffel validation fields (pointer like /slices/0/origin). */
function fieldFromPointer(pointer: string | undefined): string | undefined {
  return pointer?.replace(/^\//, "").replaceAll("/", ".");
}

function mapError(status: number, body: unknown, op: string): FlightProviderError {
  const first = errorBodySchema.safeParse(body).data?.errors?.[0];
  if (status === 401 || status === 403)
    return new FlightProviderError("not_configured", "The flight provider rejected our credentials. Please contact your administrator.", 503);
  if (status === 404)
    return new FlightProviderError("offer_expired", "This fare is no longer available. Please search again.", 404);
  if (status === 429)
    return new FlightProviderError("rate_limited", "Too many flight searches right now. Please wait a minute and try again.", 429);
  if (status === 400 || status === 422) {
    if (first?.code === "offer_no_longer_available" || first?.code === "offer_expired")
      return new FlightProviderError("offer_expired", "This fare is no longer available. Please search again.", 410);
    // Duffel validation messages are written for people ("Expected a valid IATA code").
    return new FlightProviderError("invalid_request", first?.message ?? "Please check the search details.", 400, fieldFromPointer(first?.source?.pointer));
  }
  console.error(`[duffel] ${op} failed with HTTP ${status}:`, first?.code ?? "unknown");
  return new FlightProviderError("provider_unavailable", "The airline systems didn't respond properly. Please try again.", 502);
}

/**
 * Calls the Duffel REST API (v2). Logs operation, status, Duffel request id and
 * our correlation id — never the token or passenger data.
 */
export async function duffelRequest<T>(
  method: "GET" | "POST",
  path: string,
  schema: z.ZodType<T>,
  { body, timeoutMs = DEFAULT_TIMEOUT_MS, signal }: { body?: unknown; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const config = getDuffelConfig();
  const correlationId = randomUUID();
  const op = `${method} ${path.split("?")[0]}`;
  const started = Date.now();

  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Duffel-Version": "v2",
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Correlation-Id": correlationId,
      },
      body: body === undefined ? undefined : JSON.stringify({ data: body }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error(`[duffel] ${op} ${timedOut ? "timed out" : "network error"} corr=${correlationId}`);
    throw new FlightProviderError(
      timedOut ? "timeout" : "provider_unavailable",
      timedOut ? "The airlines took too long to respond. Please try again." : "Couldn't reach the flight provider. Please check the connection and try again.",
      504,
    );
  }

  const requestId = res.headers.get("x-request-id");
  const json: unknown = await res.json().catch(() => null);
  console.info(`[duffel] ${op} → ${res.status} in ${Date.now() - started}ms req=${requestId} corr=${correlationId} mode=${config.liveMode ? "live" : "test"}`);

  if (!res.ok) throw mapError(res.status, json, op);

  const parsed = z.object({ data: schema }).safeParse(json);
  if (!parsed.success) {
    console.error(`[duffel] ${op} unexpected response shape req=${requestId}:`, parsed.error.issues.slice(0, 3).map((i) => i.path.join(".")));
    throw new FlightProviderError("provider_unavailable", "The flight provider sent data we couldn't read. Please try again.");
  }
  return parsed.data.data;
}
