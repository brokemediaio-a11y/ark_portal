import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/features/auth/server";
async function AdminAccess({ children }: { children: ReactNode }) { await requireUser("users"); return children; }
export default function AdminLayout({ children }: { children: ReactNode }) { return <Suspense fallback={<p>Checking access…</p>}><AdminAccess>{children}</AdminAccess></Suspense>; }
