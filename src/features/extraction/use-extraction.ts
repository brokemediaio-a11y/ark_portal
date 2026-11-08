"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExtractResponse } from "./schema";

type ErrorResponse = Extract<ExtractResponse, { ok: false }>;

export type ExtractionState<T> =
  | { status: "idle" }
  | { status: "working"; stage: number }
  | { status: "success"; result: Extract<ExtractResponse<T>, { ok: true }> }
  | { status: "error"; error: string; code: ErrorResponse["code"] | "network" };

/** Friendly progress messages; we advance through them while the request runs. */
export const EXTRACTION_STAGES = [
  "Uploading your documents…",
  "Reading the documents…",
  "Finding flights, dates and details…",
  "Almost done — checking every value against the documents…",
] as const;

const STAGE_DELAYS_MS = [1200, 5000, 12000];

/** Uploads one or more files to an extraction endpoint and tracks progress for the UI. */
export function useExtraction<T>(endpoint: string) {
  const [state, setState] = useState<ExtractionState<T>>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    clearTimers();
    setState({ status: "idle" });
  }, []);

  // Also runs when the page is kept in the background on navigation, so coming back starts fresh.
  useEffect(() => () => {
    abortRef.current?.abort();
    clearTimers();
    setState({ status: "idle" });
  }, []);

  const run = useCallback(
    async (files: File[]) => {
      abortRef.current?.abort();
      clearTimers();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({ status: "working", stage: 0 });
      let elapsed = 0;
      STAGE_DELAYS_MS.forEach((delay, i) => {
        elapsed += delay;
        timersRef.current.push(setTimeout(() => setState({ status: "working", stage: i + 1 }), elapsed));
      });

      try {
        const body = new FormData();
        for (const file of files) body.append("file", file);
        const res = await fetch(endpoint, { method: "POST", body, signal: controller.signal });
        const json = (await res.json().catch(() => null)) as ExtractResponse<T> | null;
        clearTimers();
        if (!json) {
          setState({ status: "error", error: "The server sent an unexpected response. Please try again.", code: "network" });
          return null;
        }
        if (!json.ok) {
          setState({ status: "error", error: json.error, code: json.code });
          return null;
        }
        setState({ status: "success", result: json });
        return json;
      } catch (error) {
        clearTimers();
        if (controller.signal.aborted) return null;
        console.error(error);
        setState({ status: "error", error: "We couldn't reach the server. Check your internet connection and try again.", code: "network" });
        return null;
      }
    },
    [endpoint],
  );

  return { state, run, cancel };
}
