"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ROLES, type Role } from "./permissions";

interface RecoveryRequest { id: string; user_id: string; name: string; email: string; role: Role; status: "pending" | "resolved" | "dismissed"; created_at: string }
export function RecoveryManagement() {
  const [requests, setRequests] = useState<RecoveryRequest[]>([]);
  const [selected, setSelected] = useState<RecoveryRequest | null>(null);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const response = await fetch("/api/admin/recovery", { cache: "no-store" }); const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load recovery requests.");
    setRequests(result.requests); setLoading(false);
  }
  useEffect(() => { void Promise.resolve().then(load).catch(error => { setError(error.message); setLoading(false); }); }, []);
  async function mutate(url: string, body: object) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not update the request.");
      if (result.next) { window.location.assign(result.next); return; }
      setSelected(null); setNotice("Request handled. Share any temporary password privately with the verified account owner."); await load();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not connect."); }
    finally { setBusy(false); }
  }
  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await mutate("/api/admin/users", { id: selected.user_id, action: "reset-password", password: values.password });
  }
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold text-brand">Password requests</h1><p className="mt-2 text-ink-muted">Recovery requests from employees and administrators. Verify the account owner privately before resetting a password.</p></div>
    {error && <p role="alert" className="rounded-xl bg-danger-soft p-4 text-danger">{error}</p>}
    {notice && <p role="status" className="text-sm text-brand">{notice}</p>}
    {selected && <section className="rounded-xl border border-line bg-white p-6">
      <h2 className="mb-4 text-xl font-bold text-brand">Reset {selected.email}</h2>
      <form key={selected.id} onSubmit={reset}><fieldset disabled={busy} className="space-y-4">
        <label className="block text-sm font-medium">Temporary password (at least 12 characters)<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={256} className="mt-2 block h-11 w-full rounded-lg border border-line px-3" /></label>
        <p className="text-sm text-ink-muted">Existing sessions will be signed out. The user must choose a new password on their next sign-in.</p>
        <div className="flex gap-3"><Button type="submit" loading={busy}>Reset password & resolve request</Button><Button variant="secondary" onClick={() => setSelected(null)}>Cancel</Button></div>
      </fieldset></form>
    </section>}
    <section className="rounded-xl border border-line bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-xl font-bold text-brand">Requests</h2><Button variant="secondary" disabled={busy} onClick={() => { void load().catch(error => setError(error.message)); }}>Refresh</Button></div>
      {loading ? <p>Loading requests…</p> : !requests.length ? <p className="text-ink-muted">No password requests yet.</p> : <ul className="divide-y divide-line">{requests.map(request => <li key={request.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div><p className="font-semibold">{request.name}</p><p className="text-sm">{request.email} · {ROLES[request.role].label}</p><p className="mt-1 text-sm text-ink-muted">{request.status} · {new Date(request.created_at).toLocaleString()}</p></div>
        {request.status === "pending" && <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => setSelected(request)}>Reset password</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => { void mutate("/api/admin/recovery", { id: request.id, action: "dismiss" }); }}>Dismiss</Button></div>}
      </li>)}</ul>}
    </section>
  </div>;
}
