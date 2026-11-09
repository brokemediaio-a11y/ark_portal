"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { issuesByField, type ReviewIssue } from "./review";
import type { FlightSegment, ReviewFlag } from "./schema";

export type SaveState = "saved" | "saving" | "error";

const AUTOSAVE_DELAY_MS = 600;

/** Anything edited as flights plus review flags: quotations and e-tickets. */
export interface EditableDocument<S extends FlightSegment> {
  segments: S[];
  reviewFlags: ReviewFlag[];
}

interface DocumentEditorOptions<T, S> {
  save: (doc: T) => void | Promise<unknown>;
  review: (doc: T) => ReviewIssue[];
  /** A new flight, given the last one (to pre-fill its origin). */
  newSegment: (previous: S | undefined) => S;
}

/** Editing a field counts as reviewing it, so its AI flag is cleared. */
function withoutFlags<T extends { reviewFlags: ReviewFlag[] }>(doc: T, fields: string[]): T {
  return doc.reviewFlags.some((f) => fields.includes(f.field))
    ? { ...doc, reviewFlags: doc.reviewFlags.filter((f) => !fields.includes(f.field)) }
    : doc;
}

/** Flags point at list items by index (e.g. "segments.2.x"), so re-index them when items move or are removed. */
function remapFlags(flags: ReviewFlag[], list: string, mapIndex: (i: number) => number | null): ReviewFlag[] {
  const pattern = new RegExp(`^${list}\\.(\\d+)\\.(.+)$`);
  return flags.flatMap((flag) => {
    const match = pattern.exec(flag.field);
    if (!match) return [flag];
    const next = mapIndex(Number(match[1]));
    return next === null ? [] : [{ ...flag, field: `${list}.${next}.${match[2]}` }];
  });
}

/** Array fields of a document that hold objects, e.g. "segments" or a ticket's "passengers". */
type ListKey<T> = { [K in keyof T]: T[K] extends readonly object[] ? K : never }[keyof T] & string;
type ItemOf<T, K extends keyof T> = T[K] extends readonly (infer I)[] ? I : never;

/** Loads one document, applies edits, keeps review flags in step, and autosaves. */
export function useDocumentEditor<S extends FlightSegment, T extends EditableDocument<S>>(initial: T, options: DocumentEditorOptions<T, S>) {
  const [doc, setDoc] = useState(initial);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const firstRender = useRef(true);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState("saving");
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        await optionsRef.current.save(doc);
        if (!cancelled) setSaveState("saved");
      } catch {
        if (!cancelled) setSaveState("error");
      }
    }, AUTOSAVE_DELAY_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [doc]);

  const update = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setDoc((d) => withoutFlags({ ...d, [key]: value }, [String(key)]));
  }, []);

  const updateNested = useCallback(<K extends keyof T>(key: K, patch: Partial<T[K]>) => {
    setDoc((d) => withoutFlags({ ...d, [key]: { ...d[key], ...patch } }, Object.keys(patch).map((k) => `${String(key)}.${k}`)));
  }, []);

  const updateItem = useCallback(<K extends ListKey<T>>(list: K, index: number, patch: Partial<ItemOf<T, K>>) => {
    setDoc((d) => {
      const items = (d[list] as readonly object[]).map((item, i) => (i === index ? { ...item, ...patch } : item));
      return withoutFlags({ ...d, [list]: items }, Object.keys(patch).map((k) => `${list}.${index}.${k}`));
    });
  }, []);

  const addItem = useCallback(<K extends ListKey<T>>(list: K, item: ItemOf<T, K>) => {
    setDoc((d) => ({ ...d, [list]: [...(d[list] as readonly object[]), item] }));
  }, []);

  const removeItem = useCallback(<K extends ListKey<T>>(list: K, index: number) => {
    setDoc((d) => ({
      ...d,
      [list]: (d[list] as readonly object[]).filter((_, i) => i !== index),
      reviewFlags: remapFlags(d.reviewFlags, list, (i) => (i === index ? null : i > index ? i - 1 : i)),
    }));
  }, []);

  const moveItem = useCallback(<K extends ListKey<T>>(list: K, index: number, direction: -1 | 1) => {
    setDoc((d) => {
      const items = [...(d[list] as readonly object[])];
      const target = index + direction;
      if (target < 0 || target >= items.length) return d;
      [items[index], items[target]] = [items[target], items[index]];
      return { ...d, [list]: items, reviewFlags: remapFlags(d.reviewFlags, list, (i) => (i === index ? target : i === target ? index : i)) };
    });
  }, []);

  const updateSegment = useCallback((index: number, patch: Partial<S>) => updateItem("segments" as ListKey<T>, index, patch as never), [updateItem]);
  const addSegment = useCallback(() => {
    setDoc((d) => ({ ...d, segments: [...d.segments, optionsRef.current.newSegment(d.segments.at(-1))] }));
  }, []);
  const removeSegment = useCallback((index: number) => removeItem("segments" as ListKey<T>, index), [removeItem]);
  const moveSegment = useCallback((index: number, direction: -1 | 1) => moveItem("segments" as ListKey<T>, index, direction), [moveItem]);

  const dismissFlag = useCallback((field: string) => {
    setDoc((d) => withoutFlags(d, [field]));
  }, []);

  const { review } = options;
  const issues = useMemo(() => review(doc), [review, doc]);
  const issueMap = useMemo(() => issuesByField(issues), [issues]);

  return {
    doc,
    issues,
    issueMap,
    saveState,
    update,
    updateNested,
    updateItem,
    addItem,
    removeItem,
    updateSegment,
    addSegment,
    removeSegment,
    moveSegment,
    dismissFlag,
  };
}
