"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExtractResponse } from "./schema";

type SuccessResponse = Extract<ExtractResponse, { ok: true }>;
type ErrorResponse = Extract<ExtractResponse, { ok: false }>;

export type ExtractionState =
  | { status: "idle" }
  | { status: "working"; stage: number }
  | { status: "success"; result: SuccessResponse }
  | { status: "error"; error: string; code: ErrorResponse["code"] | "network" };

/** Friendly progress messages; we advance through them while the request runs. */
export const EXTRACTION_STAGES = [
  "Uploading your document…",
  "Reading the document…",
  "Finding flights, dates and prices…",
  "Almost done — checking the details…",
] as const;

const STAGE_DELAYS_MS = [1200, 4000, 9000];

/** Uploads a file to the extraction API and tracks progress for the UI. */
export function useExtraction() {
  const [state, setState] = useState<ExtractionState>({ status: "idle" });
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

  const run = useCallback(async (file: File): Promise<SuccessResponse | null> => {
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
      body.append("file", file);
      const res = await fetch("/api/quotations/extract", { method: "POST", body, signal: controller.signal });
      const json = (await res.json().catch(() => null)) as ExtractResponse | null;
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
  }, []);

  return { state, run, cancel };
}
