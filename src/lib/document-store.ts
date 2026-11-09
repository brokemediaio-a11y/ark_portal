"use client";
import { useEffect, useSyncExternalStore } from "react";
import type { ZodType } from "zod";

interface Stored { id: string; updatedAt: string }
/** Server-owned records. Never persist account/customer data in shared browser storage. */
export function createDocumentStore<T extends Stored>(kind: "quotations" | "tickets", schema: ZodType<T>) {
  let records: Record<string, T> | null = null;
  let error: string | null = null;
  const listeners = new Set<() => void>();
  let snapshot: { records: Record<string, T> | null; error: string | null } = { records, error };
  const empty = snapshot;
  const emit = () => { snapshot = { records, error }; listeners.forEach(fn => fn()); };
  let pending: Promise<void> | null = null;
  let revision = 0;
  const writes = new Map<string, Promise<unknown>>();
  async function request(method = "GET", body?: unknown) {
    const response = await fetch(`/api/documents/${kind}`, { method, cache: "no-store", headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json();
    if (response.status === 401) { window.location.assign(new URL("/login", window.location.origin).href); throw new Error("Your session has expired. Please sign in."); }
    if (!response.ok) throw new Error(data.error || "Could not save. Try again.");
    return data;
  }
  async function load() {
    if (pending) return pending;
    const startedAtRevision = revision;
    pending = (async () => {
      try {
        const data = await request(); const next: Record<string, T> = {};
        for (const value of data.records) { const record = schema.parse(value); next[record.id] = record; }
        // A response started before a save must not replace the newly saved record.
        records = startedAtRevision === revision ? next : { ...next, ...records }; error = null;
      } catch (e) { error = e instanceof Error ? e.message : "Could not load documents."; }
      finally { pending = null; emit(); }
    })();
    return pending;
  }
  return {
    list: () => Object.values(records ?? {}).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    async save(record: T) {
      // Preserve edit order when an earlier autosave is still in flight.
      const previous = writes.get(record.id) ?? Promise.resolve();
      const write = previous.catch(() => {}).then(async () => {
        const data = await request("PUT", record); const saved = schema.parse(data.record);
        revision++; records = { ...records, [saved.id]: saved }; emit(); return saved;
      });
      writes.set(record.id, write);
      try { return await write; } finally { if (writes.get(record.id) === write) writes.delete(record.id); }
    },
    async remove(id: string) {
      await (writes.get(id) ?? Promise.resolve()).catch(() => {});
      await request("DELETE", { id }); revision++; records = { ...records }; delete records[id]; emit();
    },
    useMap() {
      const state = useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => snapshot, () => empty);
      useEffect(() => { void load(); }, []);
      return { ...state, retry: () => { error = null; emit(); void load(); } };
    },
  };
}
