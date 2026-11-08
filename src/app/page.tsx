import { ArrowRight, ClipboardCheck, Download, FileInput, FilePlus2, Search, TicketCheck } from "lucide-react";
import Link from "next/link";
import { RecentQuotations } from "@/features/quotation/components/recent-quotations";
import { RecentTickets } from "@/features/ticket/components/recent-tickets";

const CHOICES = [
  {
    href: "/quotations/new",
    icon: FilePlus2,
    title: "I have a quotation from a supplier",
    text: "Upload the PDF or screenshot. We read the flights for you, you check them and add your price.",
    action: "Upload a quotation",
  },
  {
    href: "/flights/search",
    icon: Search,
    title: "I need to find flights",
    text: "Search airline fares for a route and dates, pick one, and turn it into a quotation.",
    action: "Search flights",
  },
  {
    href: "/tickets/new",
    icon: TicketCheck,
    title: "I have a ticket from a supplier",
    text: "Upload the airline's e-ticket in any format. We turn it into an Ark Travelers e-ticket for the traveller.",
    action: "Convert a ticket",
  },
];

const STEPS = [
  { icon: FileInput, title: "Add the flights", text: "Upload a supplier quote, or search for fares." },
  { icon: ClipboardCheck, title: "Check and set your price", text: "Correct anything we misread, then add your markup." },
  { icon: Download, title: "Send to your customer", text: "Download the PDF with the Ark Travelers branding." },
];

/** A dashed flight path that ends in a small plane, echoing the logo's trail. */
function FlightPath() {
  return (
    <svg viewBox="0 0 320 90" fill="none" aria-hidden className="pointer-events-none absolute -top-3 right-0 hidden w-52 text-slate md:block">
      <path d="M4 82 C 90 82, 170 66, 290 18" stroke="currentColor" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" opacity="0.7" />
      <path d="M296 14 l-18 2 l7 6 l-3 12 l8 -8 l8 4 z" fill="var(--color-brand)" transform="rotate(-8 290 18)" />
    </svg>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-12">
      <section aria-labelledby="start-heading" className="relative">
        <FlightPath />
        <h1 id="start-heading" className="text-3xl font-extrabold text-brand sm:text-4xl">What would you like to do?</h1>
        <ol className="mt-8 grid gap-6 md:grid-cols-3 md:gap-0" aria-label="How a quotation is made">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="relative flex gap-4 md:flex-col md:gap-3 md:pr-8">
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-12 -bottom-6 left-5 border-l-2 border-dashed border-slate/60 md:top-5 md:right-2 md:bottom-auto md:left-14 md:border-t-2 md:border-l-0"
                />
              )}
              <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full border-2 border-brand bg-canvas text-brand">
                <Icon size={18} aria-hidden />
              </span>
              <span className="block">
                <span className="block font-display font-bold text-brand">{title}</span>
                <span className="block text-sm text-ink-muted">{text}</span>
              </span>
            </li>
          ))}
        </ol>

        <h2 className="mt-12 text-lg font-bold text-brand">Choose what you have</h2>
        <ul className="mt-4 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {CHOICES.map(({ href, icon: Icon, title, text, action }) => (
            <li key={href}>
              <Link href={href} className="ticket group h-full">
                <span className="ticket-body block space-y-4">
                  <span className="grid size-12 place-items-center rounded-lg bg-brand text-white">
                    <Icon size={24} aria-hidden />
                  </span>
                  <span className="block space-y-1">
                    <span className="block font-display text-xl font-bold text-brand">{title}</span>
                    <span className="block text-ink-muted">{text}</span>
                  </span>
                </span>
                <span className="ticket-stub">
                  <span className="text-lg font-bold text-white">{action}</span>
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-brand-ink transition-transform group-hover:translate-x-1">
                    <ArrowRight size={22} aria-hidden />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <RecentQuotations limit={5} />
        <RecentTickets limit={5} />
      </div>
    </div>
  );
}
