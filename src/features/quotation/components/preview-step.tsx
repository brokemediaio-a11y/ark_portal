"use client";

import { CheckCheck, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SelectField } from "@/components/ui/form-field";
import { brand } from "@/config/brand";
import { downloadBlob, PdfPreviewCard } from "@/features/pdf/pdf-preview-card";
import { layoutFileSuffix, PDF_LAYOUTS, type PdfLayout } from "@/features/pdf/layout";
import { SendPdfCard } from "@/features/pdf/send-pdf-card";
import { useQuotationPdf } from "@/features/pdf/use-quotation-pdf";
import { buildCustomerQuote, buildShareMessage } from "../customer-view";
import type { QuotationEditor } from "../use-quotation-editor";

const pdfFileName = (quoteNumber: string, layout: PdfLayout) => `${brand.name.replace(/\s+/g, "-")}-Quotation-${quoteNumber}${layoutFileSuffix(layout)}.pdf`;

export function PreviewStep({ editor }: { editor: QuotationEditor }) {
  const { quotation: q, update } = editor;
  const view = useMemo(() => buildCustomerQuote(q), [q]);
  const [layout, setLayout] = useState<PdfLayout>("mobile");
  const pdf = useQuotationPdf(view, layout);
  const fileName = pdfFileName(q.quoteNumber, layout);
  const message = useMemo(() => buildShareMessage(view), [view]);
  const [downloaded, setDownloaded] = useState<PdfLayout | null>(null);

  const download = () => {
    if (!pdf.blob) return;
    downloadBlob(pdf.blob, fileName);
    setDownloaded(layout);
    if (q.status === "draft") update("status", "ready");
  };

  const subject = `Your flight quotation ${q.quoteNumber} — ${brand.name}`;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <PdfPreviewCard pdf={pdf} title="Quotation preview" description="This is exactly what your customer will see." className="overflow-hidden lg:col-span-3" />

      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader icon={Download} title="1. Download the PDF" />
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

        <SendPdfCard
          title="2. Send it to the customer"
          blob={pdf.blob}
          fileName={fileName}
          subject={subject}
          message={message}
          email={q.customer.email}
          phone={q.customer.phone}
          onSent={() => q.status === "draft" && update("status", "ready")}
        />

        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-medium text-ink">{q.status === "sent" ? "Marked as sent" : "Sent it already?"}</p>
              <p className="text-ink-muted">Helps you keep track on the home page.</p>
            </div>
            <Button
              variant={q.status === "sent" ? "secondary" : "primary"}
              size="sm"
              icon={CheckCheck}
              onClick={() => update("status", q.status === "sent" ? "ready" : "sent")}
            >
              {q.status === "sent" ? "Undo" : "Mark as sent"}
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
