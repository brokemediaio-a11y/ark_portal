import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/features/auth/server";
import { AuthForm } from "@/features/auth/auth-form";
import { SignOut } from "@/features/auth/sign-out";

async function Password() {
  const user = await currentUser(); if (!user) redirect("/login");
  return <main className="grid min-h-screen place-items-center bg-canvas px-4 py-12"><section className="w-full max-w-md space-y-6 rounded-2xl border border-line bg-white p-8">
    <h1 className="text-2xl font-bold text-brand">{user.mustChangePassword ? "Set your own password" : "Change your password"}</h1>
    <p className="text-sm text-ink-muted">Signed in as {user.email}. {user.mustChangePassword ? "Replace your temporary password before entering the portal." : "Changing your password signs out your other sessions."}</p>
    <AuthForm mode="change-password" /><SignOut />
  </section></main>;
}
export default function PasswordPage() { return <Suspense fallback={<p className="p-8">Loading…</p>}><Password /></Suspense>; }
