"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, Mail, UserRound, type LucideIcon } from "lucide-react";

export function AuthForm({ mode }: { mode: "login" | "setup" | "change-password" }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, action: mode }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Please try again.");
      window.location.assign(result.next || "/");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not connect. Try again."); setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset disabled={busy} className="space-y-5">
        {mode === "setup" && <><Field name="setupKey" label="Setup key" type="password" icon={KeyRound} autoComplete="off" placeholder="Enter your setup key" /><Field name="name" label="Your name" icon={UserRound} autoComplete="name" placeholder="Full name" /></>}
        {mode !== "change-password" && <Field name="email" label="Email address" type="email" icon={Mail} autoComplete="username" placeholder="you@arktravelers.com" autoCapitalize="none" spellCheck={false} />}
        {mode === "change-password" && <Field name="currentPassword" label="Current / temporary password" type="password" icon={LockKeyhole} autoComplete="current-password" />}
        <Field name="password" label={mode === "login" ? "Password" : "New password (at least 12 characters)"} type="password" icon={LockKeyhole} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? 1 : 12} placeholder={mode === "login" ? "Enter your password" : "Choose a strong password"} />
      </fieldset>
      {error && <p role="alert" className="rounded-xl border border-danger/15 bg-danger-soft px-4 py-3 text-sm leading-relaxed text-danger">{error}</p>}
      <Button type="submit" loading={busy} iconRight={ArrowRight} className="h-12 w-full rounded-xl font-semibold shadow-[0_4px_12px_rgba(31,48,67,0.14)]">{mode === "login" ? "Sign in" : mode === "setup" ? "Create administrator account" : "Save new password"}</Button>
      {mode === "login" && <div className="border-t border-line/70 pt-5 text-center text-xs leading-relaxed text-ink-muted"><p>Need access or help signing in?</p><p className="mt-1 font-medium text-brand">Contact your administrator.</p></div>}
      {mode === "setup" && <p className="text-center text-xs leading-relaxed text-ink-muted">Use the setup key provided by your system administrator.</p>}
    </form>
  );
}
function Field({ label, icon: Icon, type = "text", ...props }: React.ComponentProps<"input"> & { label: string; icon: LucideIcon }) {
  const [visible, setVisible] = useState(false);
  const password = type === "password";
  const id = `auth-${props.name}`;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-xs font-semibold text-brand">{label}</label>
      <div className="group relative">
        <Icon size={17} aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint transition-colors group-focus-within:text-brand" />
        <input {...props} id={id} type={password && visible ? "text" : type} required className={`block h-12 w-full rounded-xl border border-line bg-surface/40 pl-11 text-sm text-ink transition-[border-color,box-shadow,background-color] outline-none placeholder:text-ink-faint/80 hover:border-slate/60 focus:border-brand/50 focus:bg-white focus:ring-4 focus:ring-brand/[0.06] disabled:opacity-60 ${password ? "pr-12" : "pr-4"}`} />
        {password && <button type="button" onClick={() => setVisible(value => !value)} aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={visible} aria-controls={id} className="absolute inset-y-1 right-1 flex w-10 cursor-pointer items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-brand-soft/60 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">{visible ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}</button>}
      </div>
    </div>
  );
}
