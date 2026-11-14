"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ROLES, type PortalUser, type Role } from "./permissions";
import { usePortalUser } from "./context";
import { LegacyImport } from "./legacy-import";

interface Activity { id: number; actor: string; action: string; subject: string; created_at: string }
const input = "mt-1 block h-11 w-full rounded-lg border border-line bg-white px-3 text-ink";
export function UserManagement() {
  const self = usePortalUser();
  const superAdmin = self?.role === "super_admin";
  const [users, setUsers] = useState<PortalUser[]>([]); const [activity, setActivity] = useState<Activity[]>([]);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PortalUser | null>(null); const [role, setRole] = useState<Role>("converter");
  const [resetting, setResetting] = useState<PortalUser | null>(null);
  const [notice, setNotice] = useState("");
  async function load() {
    const response = await fetch("/api/admin/users", { cache: "no-store" }); const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load users.");
    setUsers(result.users); setActivity(result.activity); setLoading(false);
  }
  useEffect(() => { void Promise.resolve().then(load).catch(e => { setError(e.message); setLoading(false); }); }, []);
  async function mutate(method: string, body: object) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/users", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not save changes.");
      if (result.next) { window.location.assign(result.next); return true; }
      setNotice("Changes saved."); await load(); return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Could not connect. Try again."); return false; }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form));
    const success = await mutate(editing ? "PATCH" : "POST", { ...values, role, ...(editing ? { id: editing.id, action: "update", active: values.active === "on" } : {}) });
    if (success) { setEditing(null); setRole("converter"); form.reset(); }
  }
  return <div className="space-y-8">
    <div><h1 className="text-3xl font-bold text-brand">Users & access</h1><p className="mt-2 text-ink-muted">Create an employee account, choose their role, and set a temporary password. They will choose their own password on first sign-in.</p></div>
    {error && <p role="alert" className="rounded-xl bg-danger-soft p-4 text-danger">{error}</p>}
    {notice && <p role="status" className="text-sm text-brand">{notice}</p>}
    {resetting && <section className="rounded-xl border border-line bg-white p-6">
      <h2 className="mb-5 text-xl font-bold text-brand">Reset password for {resetting.name}</h2>
      <form key={resetting.id} onSubmit={async event => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.currentTarget));
        if (await mutate("PATCH", { id: resetting.id, action: "reset-password", password: values.password })) setResetting(null);
      }}><fieldset disabled={busy} className="space-y-5">
        <label className="block text-sm font-medium">Temporary password (at least 12 characters)<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={256} className={input} /></label>
        <p className="text-sm text-ink-muted">This signs out the user’s existing sessions. Share the temporary password privately. The user must replace it once at their next sign-in.</p>
        <div className="flex gap-3"><Button type="submit" loading={busy}>Save password</Button><Button variant="secondary" disabled={busy} onClick={() => setResetting(null)}>Cancel</Button></div>
      </fieldset></form>
    </section>}
    <section className="rounded-xl border border-line bg-white p-6">
      <h2 className="mb-5 text-xl font-bold text-brand">{editing ? `Edit ${editing.name}` : "Create a user"}</h2>
      <form key={editing?.id || "new"} onSubmit={save}><fieldset disabled={busy} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Full name<input name="name" required minLength={2} maxLength={100} defaultValue={editing?.name} className={input} /></label><label className="text-sm font-medium">Email address<input name="email" type="email" required maxLength={254} defaultValue={editing?.email} className={input} /></label></div>
        {!editing && <label className="block text-sm font-medium">Temporary password (at least 12 characters)<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={256} className={input} /></label>}
        <fieldset><legend className="mb-3 text-sm font-semibold">Choose a role</legend><div className="grid gap-3 sm:grid-cols-2">{Object.entries(ROLES).filter(([value]) => superAdmin || value !== "super_admin").map(([value, definition]) => <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${role === value ? "border-brand bg-surface" : "border-line"}`}><input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value as Role)} className="mt-1" /><span><span className="block font-semibold">{definition.label}</span><span className="mt-1 block text-sm text-ink-muted">{definition.description}</span></span></label>)}</div></fieldset>
        {editing && <label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" defaultChecked={editing.active} />Account active (uncheck to revoke access)</label>}
        <div className="flex gap-3"><Button type="submit" loading={busy}>{editing ? "Save changes" : "Create user"}</Button>{editing && <Button variant="secondary" onClick={() => { setEditing(null); setRole("converter"); }}>Cancel</Button>}</div>
      </fieldset></form>
    </section>
    <section className="rounded-xl border border-line bg-white p-6"><h2 className="mb-4 text-xl font-bold text-brand">Team accounts</h2>{loading ? <p>Loading accounts…</p> : <ul className="divide-y divide-line">{users.map(user => <li key={user.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className="font-semibold">{user.name} {user.id === self?.id && "(you)"}</p><p className="text-sm text-ink-muted">{user.email}</p><p className="mt-1 text-sm">{ROLES[user.role].label} · {user.active ? "Active" : "Disabled"}{user.mustChangePassword && " · Password change required"}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={busy || (!superAdmin && user.role === "super_admin")} onClick={() => { setResetting(null); setEditing(user); setRole(user.role); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit access</Button>{user.id !== self?.id && (superAdmin || user.role !== "super_admin") && <><Button size="sm" variant="secondary" disabled={busy} onClick={() => { setEditing(null); setRole("converter"); setResetting(user); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Reset password</Button><Button size="sm" variant={user.active ? "danger" : "secondary"} disabled={busy} onClick={() => { if (confirm(`${user.active ? "Disable" : "Enable"} ${user.name}'s account?`)) void mutate("PATCH", { ...user, action: "update", active: !user.active }); }}>{user.active ? "Disable" : "Enable"}</Button>{superAdmin && <Button size="sm" variant="danger" disabled={busy} onClick={() => { if (confirm(`Permanently delete ${user.name} and all their documents?`)) void mutate("DELETE", { id: user.id }); }}>Delete account</Button>}</>}</div></li>)}</ul>}</section>
    <section className="rounded-xl border border-line bg-white p-6"><h2 className="mb-4 text-xl font-bold text-brand">Recent activity</h2><p className="mb-4 text-sm text-ink-muted">Account changes, sign-ins, document creation and deletion. Passwords and document contents are never recorded here.</p><ul className="space-y-3">{activity.map(item => <li key={item.id} className="border-b border-line pb-3 text-sm"><p><strong>{item.actor || "System"}</strong> · {item.action}</p><p className="break-all text-ink-muted">{item.subject} · {new Date(item.created_at).toLocaleString()}</p></li>)}</ul></section>
    <LegacyImport />
  </div>;
}
