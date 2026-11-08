"use client";

import { CheckCheck, Copy, Download, Mail, MessageCircle, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { brand } from "@/config/brand";
import { downloadBlob, PdfPreviewCard } from "@/features/pdf/pdf-preview-card";
import { useQuotationPdf } from "@/features/pdf/use-quotation-pdf";
import { buildCustomerQuote, buildShareMessage } from "../customer-view";
import type { QuotationEditor } from "../use-quotation-editor";

const pdfFileName = (quoteNumber: string) => `${brand.name.replace(/\s+/g, "-")}-Quotation-${quoteNumber}.pdf`;

const digitsOnly = (phone: string | null) => (phone ?? "").replace(/\D/g, "");

export function PreviewStep({ editor }: { editor: QuotationEditor }) {
  const { quotation: q, update } = editor;
  const view = useMemo(() => buildCustomerQuote(q), [q]);
  const pdf = useQuotationPdf(view);
  const message = useMemo(() => buildShareMessage(view), [view]);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const download = () => {
    if (!pdf.blob) return;
    downloadBlob(pdf.blob, pdfFileName(q.quoteNumber));
    setDownloaded(true);
    if (q.status === "draft") update("status", "ready");
  };

  const subject = `Your flight quotation ${q.quoteNumber} — ${brand.name}`;
  const mailto = `mailto:${encodeURIComponent(q.customer.email ?? "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  const phone = digitsOnly(q.customer.phone);
  const whatsapp = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <PdfPreviewCard pdf={pdf} title="Quotation preview" description="This is exactly what your customer will see." className="overflow-hidden lg:col-span-3" />

      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader icon={Download} title="1. Download the PDF" />
          <CardBody className="space-y-3">
            <Button size="lg" variant="accent" icon={downloaded ? CheckCheck : Download} className="w-full" onClick={download} disabled={!pdf.blob}>
              {downloaded ? "Downloaded — download again" : "Download PDF"}
            </Button>
            <p className="text-xs text-ink-muted">Saved as {pdfFileName(q.quoteNumber)}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={Send} title="2. Send it to the customer" description="Opens a ready-written message. Attach the downloaded PDF before sending." />
          <CardBody className="space-y-3">
            <a href={mailto} className={buttonClasses({ variant: "secondary" }, "w-full")}>
              <Mail size={18} aria-hidden /> Write email
            </a>
            {phone.length >= 8 ? (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "secondary" }, "w-full")}>
                <MessageCircle size={18} aria-hidden /> Open WhatsApp chat
              </a>
            ) : (
              <Button variant="secondary" icon={MessageCircle} className="w-full" disabled title="Add the customer's phone number first">
                WhatsApp (add phone number first)
              </Button>
            )}
            <Button variant="ghost" icon={copied ? CheckCheck : Copy} className="w-full" onClick={copyMessage}>
              {copied ? "Message copied" : "Copy message text"}
            </Button>
          </CardBody>
        </Card>

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
