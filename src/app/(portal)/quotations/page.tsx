import type { Metadata } from "next";
import { RecentQuotations } from "@/features/quotation/components/recent-quotations";

export const metadata: Metadata = { title: "My quotations" };

export default function QuotationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand sm:text-3xl">My quotations</h1>
        <p className="mt-1 text-ink-muted">Open a quotation to keep editing it or to download the PDF again.</p>
      </div>
      <RecentQuotations />
    </div>
  );
}
