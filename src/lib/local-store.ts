"use client";

import { useSyncExternalStore } from "react";
import type { ZodType } from "zod";

interface Stored {
  id: string;
  updatedAt: string;
}

/**
 * Browser-local record store (prototype persistence), validated on every read.
 * Records live only in this browser. Swap a store for an API-backed repository
 * (e.g. PostgreSQL) without touching the UI: the hooks stay the same.
 */
export function createLocalStore<T extends Stored>(storageKey: string, schema: ZodType<T>) {
  const changeEvent = `ark:${storageKey}-changed`;
  let cachedRaw: string | null | undefined;
  let cachedMap: Record<string, T> = {};
  const EMPTY: Record<string, T> = {};

  function readAll(): Record<string, T> {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(storageKey);
    } catch {
      return cachedMap;
    }
    if (raw === cachedRaw) return cachedMap;
    cachedRaw = raw;
    cachedMap = {};
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      for (const value of Object.values(parsed as Record<string, unknown>)) {
        const result = schema.safeParse(value);
        if (result.success) cachedMap[result.data.id] = result.data;
      }
    } catch {
      // Corrupt storage: start fresh rather than crash.
    }
    return cachedMap;
  }

  function writeAll(map: Record<string, T>) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(map));
    } catch {
      throw new Error("Could not save. Your browser storage may be full or disabled.");
    }
    window.dispatchEvent(new Event(changeEvent));
  }

  function subscribe(onChange: () => void) {
    window.addEventListener(changeEvent, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(changeEvent, onChange);
      window.removeEventListener("storage", onChange);
    };
  }

  return {
    get(id: string): T | null {
      return readAll()[id] ?? null;
    },
    list(): T[] {
      return Object.values(readAll()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    save(record: T): T {
      const saved = { ...record, updatedAt: new Date().toISOString() };
      writeAll({ ...readAll(), [saved.id]: saved });
      return saved;
    },
    remove(id: string) {
      const next = { ...readAll() };
      delete next[id];
      writeAll(next);
    },
    /** All saved records, or null while the page is still loading on the server. */
    useMap(): Record<string, T> | null {
      const map = useSyncExternalStore(subscribe, readAll, () => EMPTY);
      // useSyncExternalStore returns the server snapshot during hydration.
      return map === EMPTY ? null : map;
    },
  };
}
