"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Explicit admin claim: never auto-assign shared-browser records to an employee. */
export function LegacyImport() {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function run() {
    if (!confirm("Import old quotations and tickets from this browser into the administrator account? Only import records that belong to your agency.")) return;
    setBusy(true); let count = 0;
    try {
      for (const kind of ["quotations", "tickets"]) {
        const records = JSON.parse(localStorage.getItem(`ark.${kind}.v1`) || "{}");
        const response = await fetch(`/api/documents/${kind}`, { cache: "no-store" }); const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        const known = new Set(data.records.map((record: { id: string }) => record.id));
        for (const record of Object.values(records) as { id: string }[]) {
          if (known.has(record.id)) continue;
          const saved = await fetch(`/api/documents/${kind}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record) });
          if (!saved.ok) throw new Error((await saved.json()).error || "Could not import a record.");
          count++;
        }
      }
      setMessage(`Imported ${count} records. Original browser data was preserved.`);
    } catch (e) { setMessage(`Imported ${count} records. ${e instanceof Error ? e.message : "Import failed."} You can retry; existing records are skipped.`); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-xl border border-line bg-white p-6"><h2 className="text-lg font-bold text-brand">Existing browser documents</h2><p className="text-sm text-ink-muted">Documents made before login was added can be imported into this administrator account. Existing server records are skipped.</p><Button variant="secondary" loading={busy} onClick={() => void run()}>Import from this browser</Button>{message && <p role="status" className="text-sm">{message}</p>}</section>;
}
