"use client";

import { useCallback, useRef, useState } from "react";
import type { FlightSearchRequest, FlightSearchResponse } from "./schema";

type Success = Extract<FlightSearchResponse, { ok: true }>;
type Failure = Extract<FlightSearchResponse, { ok: false }>;

export type FlightSearchState =
  | { status: "idle" }
  | { status: "loading"; request: FlightSearchRequest }
  | { status: "success"; request: FlightSearchRequest; result: Success }
  | { status: "error"; request: FlightSearchRequest; error: string; code: Failure["code"] | "network"; field?: string };

/** Calls the flight search API; the latest search always wins. */
export function useFlightSearch() {
  const [state, setState] = useState<FlightSearchState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (request: FlightSearchRequest) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: "loading", request });

    try {
      const res = await fetch("/api/flights/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      const json = (await res.json().catch(() => null)) as FlightSearchResponse | null;
      if (controller.signal.aborted) return;
      if (!json) setState({ status: "error", request, error: "The server sent an unexpected response. Please try again.", code: "network" });
      else if (!json.ok) setState({ status: "error", request, error: json.error, code: json.code, field: json.field });
      else setState({ status: "success", request, result: json });
    } catch {
      if (!controller.signal.aborted)
        setState({ status: "error", request, error: "We couldn't reach the server. Check your internet connection and try again.", code: "network" });
    }
  }, []);

  return { state, search };
}
