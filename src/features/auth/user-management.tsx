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
  const [users, setUsers] = useState<PortalUser[]>([]); const [activity, setActivity] = useState<Activity[]>([]);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PortalUser | null>(null); const [role, setRole] = useState<Role>("converter");
  const [credentials, setCredentials] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [copied, setCopied] = useState(false); const [notice, setNotice] = useState("");
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
      if (result.temporaryPassword) { setCredentials(result); setCopied(false); }
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
    <div><h1 className="text-3xl font-bold text-brand">Users & access</h1><p className="mt-2 text-ink-muted">Create an employee account, choose their role, and share their temporary credentials privately.</p></div>
    {error && <p role="alert" className="rounded-xl bg-danger-soft p-4 text-danger">{error}</p>}
    {notice && <p role="status" className="text-sm text-brand">{notice}</p>}
    {credentials && <section className="space-y-3 rounded-xl border-2 border-brand bg-white p-6" aria-label="New credentials">
      <h2 className="text-lg font-bold text-brand">Credentials ready to share</h2><p className="text-sm text-ink-muted">The temporary password is shown once. The employee must replace it on first sign-in.</p>
      <dl><dt className="text-sm text-ink-muted">Email</dt><dd className="font-semibold">{credentials.email}</dd><dt className="mt-2 text-sm text-ink-muted">Temporary password</dt><dd className="break-all rounded-lg bg-surface p-3 font-mono">{credentials.temporaryPassword}</dd></dl>
      <div className="flex gap-3"><Button onClick={async () => { try { await navigator.clipboard.writeText(`Portal: ${window.location.origin}/login\nEmail: ${credentials.email}\nTemporary password: ${credentials.temporaryPassword}\nPlease change your password on first sign-in.`); setCopied(true); } catch { setError("Clipboard is unavailable. Copy the credentials shown above."); } }}>{copied ? "Copied" : "Copy login details"}</Button><Button variant="secondary" onClick={() => setCredentials(null)}>Done</Button></div>
    </section>}
    <section className="rounded-xl border border-line bg-white p-6">
      <h2 className="mb-5 text-xl font-bold text-brand">{editing ? `Edit ${editing.name}` : "Create a user"}</h2>
      <form key={editing?.id || "new"} onSubmit={save} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Full name<input name="name" required minLength={2} maxLength={100} defaultValue={editing?.name} className={input} /></label><label className="text-sm font-medium">Email address<input name="email" type="email" required maxLength={254} defaultValue={editing?.email} className={input} /></label></div>
        <fieldset><legend className="mb-3 text-sm font-semibold">Choose a role</legend><div className="grid gap-3 sm:grid-cols-2">{Object.entries(ROLES).map(([value, definition]) => <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${role === value ? "border-brand bg-surface" : "border-line"}`}><input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value as Role)} className="mt-1" /><span><span className="block font-semibold">{definition.label}</span><span className="mt-1 block text-sm text-ink-muted">{definition.description}</span></span></label>)}</div></fieldset>
        {editing && <label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" defaultChecked={editing.active} />Account active (uncheck to revoke access)</label>}
        <div className="flex gap-3"><Button type="submit" loading={busy}>{editing ? "Save changes" : "Create user & generate password"}</Button>{editing && <Button variant="secondary" onClick={() => { setEditing(null); setRole("converter"); }}>Cancel</Button>}</div>
      </form>
    </section>
    <section className="rounded-xl border border-line bg-white p-6"><h2 className="mb-4 text-xl font-bold text-brand">Team accounts</h2>{loading ? <p>Loading accounts…</p> : <ul className="divide-y divide-line">{users.map(user => <li key={user.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className="font-semibold">{user.name} {user.id === self?.id && "(you)"}</p><p className="text-sm text-ink-muted">{user.email}</p><p className="mt-1 text-sm">{ROLES[user.role].label} · {user.active ? "Active" : "Disabled"}{user.mustChangePassword && " · Password change required"}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={busy} onClick={() => { setEditing(user); setRole(user.role); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit access</Button>{user.id !== self?.id && <><Button size="sm" variant="secondary" disabled={busy} onClick={() => { if (confirm(`Reset ${user.name}'s password and sign out their sessions?`)) void mutate("PATCH", { id: user.id, action: "reset-password" }); }}>Reset password</Button><Button size="sm" variant={user.active ? "danger" : "secondary"} disabled={busy} onClick={() => { if (confirm(`${user.active ? "Disable" : "Enable"} ${user.name}'s account?`)) void mutate("PATCH", { ...user, action: "update", active: !user.active }); }}>{user.active ? "Disable" : "Enable"}</Button></>}</div></li>)}</ul>}</section>
    <section className="rounded-xl border border-line bg-white p-6"><h2 className="mb-4 text-xl font-bold text-brand">Recent activity</h2><p className="mb-4 text-sm text-ink-muted">Account changes, sign-ins, document creation and deletion. Passwords and document contents are never recorded here.</p><ul className="space-y-3">{activity.map(item => <li key={item.id} className="border-b border-line pb-3 text-sm"><p><strong>{item.actor || "System"}</strong> · {item.action}</p><p className="break-all text-ink-muted">{item.subject} · {new Date(item.created_at).toLocaleString()}</p></li>)}</ul></section>
    <LegacyImport />
  </div>;
}
