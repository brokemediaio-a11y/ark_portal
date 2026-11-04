"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";
import { NAV_ITEMS, isActive } from "./nav-items";

function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label={`${brand.name} home`} className={cn("block w-fit", className)}>
      <Image src="/brand/ark-logo-white.png" alt={brand.name} width={829} height={612} priority className="h-auto w-full" />
    </Link>
  );
}

/** Reads the current URL, so it must sit inside <Suspense> (see NavList below). */
function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return <NavLinks pathname={pathname} onNavigate={onNavigate} />;
}

function NavLinks({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main">
      <ul className="space-y-1">
        {NAV_ITEMS.map(({ href, label, hint, icon: Icon }) => {
          const active = pathname !== null && isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                  active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
                )}
              >
                {active && <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-accent" aria-hidden />}
                <Icon size={20} aria-hidden className={active ? "text-accent" : ""} />
                <span className="min-w-0">
                  <span className={cn("block text-sm", active ? "font-semibold" : "font-medium")}>{label}</span>
                  <span className="block truncate text-xs text-white/50">{hint}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Left sidebar on desktop; a top bar with a menu button on phones and tablets. */
export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-full lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden bg-brand lg:block">
        <div className="sticky top-0 flex h-screen flex-col gap-8 px-4 py-7">
          <Logo className="w-40 px-2" />
          <Suspense fallback={<NavLinks pathname={null} />}>
            <NavList />
          </Suspense>
          <p className="mt-auto px-3 text-xs leading-relaxed text-white/50">
            This portal prepares quotations only. It does not book or take payment.
          </p>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-20 items-center justify-between bg-brand px-4 lg:hidden">
        <Logo className="w-20" />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium text-white hover:bg-white/10"
        >
          {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          Menu
        </button>
      </header>
      {open && (
        <div id="mobile-nav" className="fixed inset-x-0 top-20 z-20 bg-brand p-3 shadow-lg lg:hidden">
          <Suspense fallback={<NavLinks pathname={null} />}>
            <NavList onNavigate={() => setOpen(false)} />
          </Suspense>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
