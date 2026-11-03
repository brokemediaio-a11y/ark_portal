import { FilePlus2, Search, Upload, PencilLine, Download } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { RecentQuotations } from "@/features/quotation/components/recent-quotations";

const HOW_IT_WORKS = [
  { icon: Upload, title: "Upload", text: "Drop in the supplier's PDF or screenshot." },
  { icon: PencilLine, title: "Check & price", text: "Review the details we filled in and add your markup." },
  { icon: Download, title: "Send", text: "Download the branded PDF and share it with your customer." },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl bg-brand text-white shadow-card">
        <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-5 lg:items-center">
          <div className="space-y-5 lg:col-span-3">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Make a customer quotation in minutes</h1>
            <p className="max-w-xl text-white/80">
              Upload a supplier quotation and we&apos;ll read the flights for you — or search flight schedules directly. Check the details, set your price, and download a professional Ark Travelers PDF.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/quotations/new" variant="accent" size="lg" icon={FilePlus2}>
                Create quotation
              </ButtonLink>
              <ButtonLink
                href="/flights/search"
                size="lg"
                icon={Search}
                className="border border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                Search flights
              </ButtonLink>
            </div>
          </div>
          <ol className="space-y-3 lg:col-span-2">
            {HOW_IT_WORKS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex items-start gap-3 rounded-2xl bg-white/10 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15">
                  <Icon size={20} aria-hidden />
                </span>
                <div>
                  <p className="font-semibold">{i + 1}. {title}</p>
                  <p className="text-sm text-white/75">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <RecentQuotations />
    </div>
  );
}
