import { requireUser } from "@/features/auth/server";
import { AuthForm } from "@/features/auth/auth-form";

export default async function SettingsPage() {
  const user = await requireUser();
  return <div className="max-w-lg space-y-6">
    <div><h1 className="text-3xl font-bold text-brand">Settings</h1><p className="mt-2 text-ink-muted">Manage the password for {user.email}.</p></div>
    <section className="rounded-2xl border border-line bg-white p-6">
      <h2 className="mb-2 text-xl font-bold text-brand">Change password</h2>
      <p className="mb-6 text-sm text-ink-muted">Enter your current password and choose a new one. Your other sessions will be signed out.</p>
      <AuthForm mode="change-password" />
    </section>
  </div>;
}
