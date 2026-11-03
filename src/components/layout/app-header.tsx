import Link from "next/link";
import { FilePlus2, Plane, Search } from "lucide-react";
import { brand } from "@/config/brand";
import { ButtonLink } from "@/components/ui/button";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-ink">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-white">
            <Plane size={18} aria-hidden />
          </span>
          <span className="leading-tight">
            {brand.name}
            <span className="block text-xs font-normal text-ink-muted">Quotation Portal</span>
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-2">
          <ButtonLink href="/flights/search" size="sm" variant="ghost" icon={Search}>
            <span className="hidden sm:inline">Search flights</span>
          </ButtonLink>
          <ButtonLink href="/quotations/new" size="sm" icon={FilePlus2}>
            <span className="hidden sm:inline">New quotation</span>
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
