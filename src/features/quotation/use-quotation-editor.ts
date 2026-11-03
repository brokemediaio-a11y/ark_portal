"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createEmptySegment } from "./factory";
import { issuesByField, reviewQuotation } from "./review";
import type { FlightSegment, Quotation } from "./schema";
import { quotationStore } from "./storage";

export type SaveState = "saved" | "saving" | "error";

const AUTOSAVE_DELAY_MS = 600;

/** Editing a field counts as reviewing it, so its AI flag is cleared. */
const withoutFlags = (q: Quotation, fields: string[]) =>
  q.reviewFlags.some((f) => fields.includes(f.field))
    ? { ...q, reviewFlags: q.reviewFlags.filter((f) => !fields.includes(f.field)) }
    : q;

/** Flags point at segments by index, so re-index them when segments move or are removed. */
function remapSegmentFlags(q: Quotation, mapIndex: (i: number) => number | null): Quotation["reviewFlags"] {
  return q.reviewFlags.flatMap((flag) => {
    const match = /^segments\.(\d+)\.(.+)$/.exec(flag.field);
    if (!match) return [flag];
    const next = mapIndex(Number(match[1]));
    return next === null ? [] : [{ ...flag, field: `segments.${next}.${match[2]}` }];
  });
}

/** Loads one quotation, applies edits, and autosaves them. */
export function useQuotationEditor(initial: Quotation) {
  const [quotation, setQuotation] = useState(initial);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState("saving");
    const timer = setTimeout(() => {
      try {
        quotationStore.save(quotation);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [quotation]);

  const update = useCallback(<K extends keyof Quotation>(key: K, value: Quotation[K]) => {
    setQuotation((q) => withoutFlags({ ...q, [key]: value }, [key]));
  }, []);

  const updateNested = useCallback(
    <K extends "customer" | "passengers" | "markup">(key: K, patch: Partial<Quotation[K]>) => {
      setQuotation((q) =>
        withoutFlags(
          { ...q, [key]: { ...q[key], ...patch } },
          Object.keys(patch).map((k) => `${key}.${k}`),
        ),
      );
    },
    [],
  );

  const updateSegment = useCallback((index: number, patch: Partial<FlightSegment>) => {
    setQuotation((q) =>
      withoutFlags(
        { ...q, segments: q.segments.map((s, i) => (i === index ? { ...s, ...patch } : s)) },
        Object.keys(patch).map((k) => `segments.${index}.${k}`),
      ),
    );
  }, []);

  const addSegment = useCallback(() => {
    setQuotation((q) => {
      const prev = q.segments.at(-1);
      // Pre-fill the new leg's origin with the previous destination — the usual case.
      const next = { ...createEmptySegment(), originCode: prev?.destinationCode ?? null, originName: prev?.destinationName ?? null };
      return { ...q, segments: [...q.segments, next] };
    });
  }, []);

  const removeSegment = useCallback((index: number) => {
    setQuotation((q) => ({
      ...q,
      segments: q.segments.filter((_, i) => i !== index),
      reviewFlags: remapSegmentFlags(q, (i) => (i === index ? null : i > index ? i - 1 : i)),
    }));
  }, []);

  const moveSegment = useCallback((index: number, direction: -1 | 1) => {
    setQuotation((q) => {
      const target = index + direction;
      if (target < 0 || target >= q.segments.length) return q;
      const segments = [...q.segments];
      [segments[index], segments[target]] = [segments[target], segments[index]];
      return {
        ...q,
        segments,
        reviewFlags: remapSegmentFlags(q, (i) => (i === index ? target : i === target ? index : i)),
      };
    });
  }, []);

  const dismissFlag = useCallback((field: string) => {
    setQuotation((q) => withoutFlags(q, [field]));
  }, []);

  const issues = useMemo(() => reviewQuotation(quotation), [quotation]);
  const issueMap = useMemo(() => issuesByField(issues), [issues]);

  return {
    quotation,
    issues,
    issueMap,
    saveState,
    update,
    updateNested,
    updateSegment,
    addSegment,
    removeSegment,
    moveSegment,
    dismissFlag,
  };
}

export type QuotationEditor = ReturnType<typeof useQuotationEditor>;
