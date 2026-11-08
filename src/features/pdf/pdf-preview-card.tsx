"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { PdfState } from "./use-quotation-pdf";

/** The live PDF preview panel used by quotations and e-tickets. */
export function PdfPreviewCard({ pdf, title, description, className }: { pdf: PdfState; title: string; description: string; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader
        title={title}
        description={description}
        actions={
          pdf.loading && pdf.url ? (
            <Loader2 size={18} className="animate-spin text-ink-muted" aria-label="Updating preview" />
          ) : pdf.url ? (
            // Fallback for browsers (e.g. on phones) that can't show PDFs inside the page.
            <a href={pdf.url} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "ghost", size: "sm" })}>
              <ExternalLink size={16} aria-hidden /> Open in new tab
            </a>
          ) : undefined
        }
      />
      <div className="relative h-[70vh] min-h-[480px] bg-surface">
        {pdf.url ? (
          <iframe src={`${pdf.url}#toolbar=0&navpanes=0&view=FitH`} title={`${title} PDF`} className="size-full" />
        ) : pdf.error ? (
          <div className="p-6"><Alert tone="error">{pdf.error}</Alert></div>
        ) : (
          <div className="grid size-full place-items-center text-sm text-ink-muted">
            <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" /> Preparing your PDF…</span>
          </div>
        )}
      </div>
    </Card>
  );
}

/** Saves a Blob as a download. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: fileName });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
