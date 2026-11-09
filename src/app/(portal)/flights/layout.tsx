import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/features/auth/server";
async function FlightAccess({ children }: { children: ReactNode }) { await requireUser("flights"); return children; }
export default function FlightLayout({ children }: { children: ReactNode }) { return <Suspense fallback={<p>Checking access…</p>}><FlightAccess>{children}</FlightAccess></Suspense>; }
