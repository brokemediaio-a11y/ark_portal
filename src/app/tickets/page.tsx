import type { Metadata } from "next";
import { RecentTickets } from "@/features/ticket/components/recent-tickets";

export const metadata: Metadata = { title: "My tickets" };

export default function TicketsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand sm:text-3xl">My tickets</h1>
        <p className="mt-1 text-ink-muted">Open an e-ticket to keep editing it or to download the PDF again.</p>
      </div>
      <RecentTickets />
    </div>
  );
}
