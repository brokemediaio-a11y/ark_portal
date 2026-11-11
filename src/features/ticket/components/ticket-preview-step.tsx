"use client";

import { CheckCheck, Download, Mail } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SelectField } from "@/components/ui/form-field";
import { brand } from "@/config/brand";
import { downloadBlob, PdfPreviewCard } from "@/features/pdf/pdf-preview-card";
import { layoutFileSuffix, PDF_LAYOUTS, type PdfLayout } from "@/features/pdf/layout";
import { useTicketPdf } from "@/features/pdf/use-quotation-pdf";
import { buildCustomerTicket } from "../ticket-view";
import type { TicketEditor } from "../use-ticket-editor";

const pdfFileName = (name: string, layout: PdfLayout) => `${brand.name.replace(/\s+/g, "-")}-E-ticket-${name.replace(/[^\w-]+/g, "")}${layoutFileSuffix(layout)}.pdf`;

export function TicketPreviewStep({ editor }: { editor: TicketEditor }) {
  const { ticket: t, update } = editor;
  const view = useMemo(() => buildCustomerTicket(t), [t]);
  const [layout, setLayout] = useState<PdfLayout>("desktop");
  const pdf = useTicketPdf(view, layout);
  const [downloaded, setDownloaded] = useState<PdfLayout | null>(null);
  const fileName = pdfFileName(t.bookingReference ?? t.ticketRef, layout);

  const download = () => {
    if (!pdf.blob) return;
    downloadBlob(pdf.blob, fileName);
    setDownloaded(layout);
    if (t.status === "draft") update("status", "ready");
  };

  const lead = view.passengers[0]?.name ?? "Traveller";
  const subject = `Your e-ticket ${t.bookingReference ?? ""} — ${brand.name}`.replace(/\s+—/, " —");
  const body = [`Dear ${lead},`, "", `Please find attached your e-ticket for ${view.routeSummary}.`, "", "Kind regards,", brand.name, ...brand.contact.phones].join("\n");
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <PdfPreviewCard pdf={pdf} title="E-ticket preview" description="This is exactly what the traveller will receive." className="overflow-hidden lg:col-span-3" />

      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader icon={Download} title="1. Download the e-ticket" />
          <CardBody className="space-y-3">
            <SelectField
              label="PDF format"
              hint="Mobile PDFs use phone-sized pages, so every flight card is readable without zooming."
              value={layout}
              onChange={(value) => value && setLayout(value)}
              options={PDF_LAYOUTS}
              placeholder={null}
            />
            <Button size="lg" variant="accent" icon={downloaded === layout ? CheckCheck : Download} className="w-full" onClick={download} disabled={!pdf.blob || pdf.loading}>
              {downloaded === layout ? "Downloaded — download again" : layout === "mobile" ? "Download mobile PDF" : "Download desktop PDF"}
            </Button>
            <p className="text-xs text-ink-muted">Saved as {fileName}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={Mail} title="2. Send it to the traveller" description="Opens a ready-written email. Attach the downloaded PDF before sending." />
          <CardBody>
            <a href={mailto} className={buttonClasses({ variant: "secondary" }, "w-full")}>
              <Mail size={18} aria-hidden /> Write email
            </a>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-medium text-ink">{t.status === "sent" ? "Marked as sent" : "Sent it already?"}</p>
              <p className="text-ink-muted">Helps you keep track in My tickets.</p>
            </div>
            <Button variant={t.status === "sent" ? "secondary" : "primary"} size="sm" icon={CheckCheck} onClick={() => update("status", t.status === "sent" ? "ready" : "sent")}>
              {t.status === "sent" ? "Undo" : "Mark as sent"}
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
