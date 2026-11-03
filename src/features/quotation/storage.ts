"use client";

import { useSyncExternalStore } from "react";
import { quotationSchema, type Quotation } from "./schema";

/**
 * Browser-local quotation store (prototype persistence).
 * Quotations live only in this browser. Swap this module for an API-backed
 * repository (e.g. PostgreSQL) without touching the UI — the hooks stay the same.
 */
const STORAGE_KEY = "ark.quotations.v1";
const CHANGE_EVENT = "ark:quotations-changed";

type QuotationMap = Record<string, Quotation>;

let cachedRaw: string | null | undefined;
let cachedMap: QuotationMap = {};

function readAll(): QuotationMap {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return cachedMap;
  }
  if (raw === cachedRaw) return cachedMap;
  cachedRaw = raw;
  cachedMap = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      const result = quotationSchema.safeParse(value);
      if (result.success) cachedMap[result.data.id] = result.data;
    }
  } catch {
    // Corrupt storage: start fresh rather than crash.
  }
  return cachedMap;
}

function writeAll(map: QuotationMap) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    throw new Error("Could not save. Your browser storage may be full or disabled.");
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export const quotationStore = {
  get(id: string): Quotation | null {
    return readAll()[id] ?? null;
  },
  list(): Quotation[] {
    return Object.values(readAll()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  save(quotation: Quotation): Quotation {
    const saved = { ...quotation, updatedAt: new Date().toISOString() };
    writeAll({ ...readAll(), [saved.id]: saved });
    return saved;
  },
  remove(id: string) {
    const next = { ...readAll() };
    delete next[id];
    writeAll(next);
  },
};

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const EMPTY: QuotationMap = {};

/** All saved quotations, or null while the page is still loading on the server. */
export function useQuotationMap(): QuotationMap | null {
  const map = useSyncExternalStore(subscribe, readAll, () => EMPTY);
  // useSyncExternalStore returns the server snapshot during hydration.
  return map === EMPTY ? null : map;
}
