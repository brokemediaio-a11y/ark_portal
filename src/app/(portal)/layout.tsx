import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/features/auth/server";
import { AuthProvider } from "@/features/auth/context";
import { AppShell } from "@/components/layout/app-shell";

async function AuthenticatedPortal({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return <AuthProvider user={user}><AppShell>{children}</AppShell></AuthProvider>;
}
export default function PortalLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p className="p-8 text-ink-muted">Loading your portal…</p>}><AuthenticatedPortal>{children}</AuthenticatedPortal></Suspense>;
}
