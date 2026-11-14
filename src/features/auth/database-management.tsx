"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface DatabaseView { table: string; offset: number; limit: number; counts: Record<string, number>; rows: Record<string, unknown>[] }
export function DatabaseManagement() {
  const [table, setTable] = useState("users"); const [offset, setOffset] = useState(0);
  const [view, setView] = useState<DatabaseView | null>(null); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      setLoading(true); setError("");
      const response = await fetch(`/api/admin/database?table=${encodeURIComponent(table)}&offset=${offset}`, { cache: "no-store" });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not load records.");
      if (!cancelled) setView(result);
    }).catch(error => { if (!cancelled) setError(error.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [table, offset]);
  async function download() {
    setDownloading(true); setError("");
    try {
      const response = await fetch("/api/admin/database", { method: "POST" });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || "Could not download backup."); }
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a");
      link.href = url; link.download = `ark-portal-${new Date().toISOString().slice(0, 10)}.sqlite`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not download backup."); }
    finally { setDownloading(false); }
  }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold text-brand">Database</h1><p className="mt-2 text-ink-muted">Browse application records or download a complete SQLite backup for development and support.</p></div><Button loading={downloading} onClick={() => { void download(); }}>Download database backup</Button></div>
    {error && <p role="alert" className="rounded-xl bg-danger-soft p-4 text-danger">{error}</p>}
    <section className="space-y-4 rounded-xl border border-line bg-white p-6">
      <label className="block text-sm font-semibold">Table<select value={table} onChange={event => { setTable(event.target.value); setOffset(0); }} className="mt-2 block h-11 w-full rounded-lg border border-line px-3">{["users", "documents", "audit", "password_reset_requests", "sessions"].map(name => <option key={name} value={name}>{name}{view ? ` (${view.counts[name]})` : ""}</option>)}</select></label>
      <p className="text-sm text-ink-muted">Passwords and session tokens are excluded from record previews. Backups contain the complete database.</p>
      {loading ? <p>Loading records…</p> : view && <><pre className="max-h-[65vh] overflow-auto rounded-lg bg-surface p-4 text-xs">{JSON.stringify(view.rows, null, 2)}</pre><div className="flex items-center gap-3"><Button variant="secondary" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>Previous</Button><span className="text-sm">{view.rows.length ? `${offset + 1}–${offset + view.rows.length}` : "0"} of {view.counts[table]}</span><Button variant="secondary" disabled={offset + 50 >= view.counts[table]} onClick={() => setOffset(value => value + 50)}>Next</Button></div></>}
    </section>
  </div>;
}
