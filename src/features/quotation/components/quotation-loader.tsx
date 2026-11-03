"use client";

import { useParams } from "next/navigation";
import { FileQuestion, Loader2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { useQuotationMap } from "../storage";
import { QuotationWorkspace } from "./quotation-workspace";

export function QuotationLoader() {
  const { id } = useParams<{ id: string }>();
  const map = useQuotationMap();

  if (!map) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-ink-muted">
        <Loader2 className="animate-spin" aria-label="Loading quotation" />
      </div>
    );
  }

  const quotation = map[id];
  if (!quotation) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <FileQuestion size={40} className="mx-auto text-ink-faint" />
        <h1 className="text-xl font-semibold text-ink">Quotation not found</h1>
        <p className="text-sm text-ink-muted">
          It may have been deleted, or it was created in a different browser. Quotations are currently saved on this computer only.
        </p>
        <ButtonLink href="/">Back to all quotations</ButtonLink>
      </div>
    );
  }

  // Keyed by id so switching quotations resets editor state. The editor owns the
  // state after first load, so autosave writes don't re-initialise it.
  return <QuotationWorkspace key={quotation.id} initial={quotation} />;
}
