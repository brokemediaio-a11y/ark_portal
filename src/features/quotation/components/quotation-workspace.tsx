"use client";

import { ArrowLeft, ArrowRight, Check, CloudOff, FileText, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { FieldReviewProvider, type FieldReview } from "@/components/ui/form-field";
import { Stepper, type StepDef } from "@/components/ui/stepper";
import { formatMoney } from "../pricing";
import { hasBlockingIssues } from "../review";
import type { Quotation } from "../schema";
import { useQuotationEditor, type SaveState } from "../use-quotation-editor";
import { CustomerPriceStep } from "./customer-price-step";
import { FlightsStep } from "./flights-step";
import { PreviewStep } from "./preview-step";
import { ReviewChecklist } from "./review-checklist";
import { StatusBadge } from "./status-badge";

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const STEPS: readonly StepDef[] = [
  { key: "flights", label: "Check flights", description: "Dates, routes, airline" },
  { key: "price", label: "Customer & price", description: "Who it's for, your markup" },
  { key: "preview", label: "Preview & send", description: "Download the PDF" },
];
const PREVIEW_STEP = 2;

/** Which step shows a given field, so the checklist can jump to it. */
const stepForField = (field: string) =>
  field.startsWith("segments") || field.startsWith("passengers") || field === "fareConditions" ? 0 : 1;

function focusField(field: string) {
  // Wait for the step to render, then bring the field into view.
  requestAnimationFrame(() =>
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector<HTMLElement>("input, select, textarea")?.focus({ preventScroll: true });
    }, 60),
  );
}

export function QuotationWorkspace({ initial }: { initial: Quotation }) {
  const editor = useQuotationEditor(initial);
  const { quotation: q, issues, issueMap, saveState, dismissFlag } = editor;
  const [step, setStep] = useState(0);
  const blocked = hasBlockingIssues(issues);

  const review = useMemo<FieldReview>(
    () => ({
      issuesFor: (path) => issueMap.get(path) ?? [],
      evidenceFor: (path) => q.reviewFlags.find((f) => f.field === path)?.evidence ?? null,
      isFlagged: (path) => q.reviewFlags.some((f) => f.field === path),
      confirm: dismissFlag,
    }),
    [issueMap, q.reviewFlags, dismissFlag],
  );

  const goTo = (index: number) => {
    setStep(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const jumpToField = (field: string) => {
    setStep(stepForField(field));
    focusField(field);
  };

  return (
    <FieldReviewProvider value={review}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <ButtonLink href="/" variant="ghost" size="sm" icon={ArrowLeft} className="-ml-3 mb-1">
              All quotations
            </ButtonLink>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-ink">
              Quotation {q.quoteNumber}
              <StatusBadge status={q.status} />
              {q.sourceType === "demo" && <Badge tone="danger">DEMO DATA</Badge>}
              {q.providerSnapshot && !q.providerSnapshot.liveMode && <Badge tone="danger">TEST MODE</Badge>}
            </h1>
            {(q.sourceFileName || q.sourceProvider) && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                <FileText size={14} aria-hidden /> From {q.sourceFileName ?? `flight search (${q.sourceProvider})`}
                {q.sourceReference && <> · Supplier ref. {q.sourceReference}</>}
              </p>
            )}
          </div>
          <SaveIndicator state={saveState} />
        </div>

        {q.providerSnapshot && !q.providerSnapshot.liveMode && (
          <Alert tone="warning" title="TEST MODE — not a real fare">
            These flights and prices come from the flight provider&apos;s test environment. The PDF is watermarked &ldquo;TEST MODE&rdquo;; don&apos;t send it
            to a customer as a real offer.
          </Alert>
        )}

        {q.sourceType === "demo" && (
          <Alert tone="warning" title="This is demo data">
            AI extraction is running in demo mode, so these details were not read from your file. Don&apos;t send this to a customer.
          </Alert>
        )}

        <div className="rounded-2xl border border-line bg-white/60 p-3">
          <Stepper steps={STEPS} current={step} maxReachable={blocked ? 1 : PREVIEW_STEP} onSelect={goTo} />
        </div>

        {step === 0 && q.sourceType === "flight_search" && (
          <Alert tone="info" title="Flights and fare added from the flight search">
            The schedule, baggage and the airline&apos;s price ({q.providerSnapshot && formatMoney(q.providerSnapshot.totalAmount, q.providerSnapshot.totalCurrency)}) were
            checked with the airline at {q.providerSnapshot && formatTime(q.providerSnapshot.refreshedAt)}. Add your markup on the next step. A quotation
            doesn&apos;t hold the fare
            {q.providerSnapshot?.expiresAt && <> — the airline guarantees it only until {formatTime(q.providerSnapshot.expiresAt)}</>}, so re-check
            before booking.
          </Alert>
        )}

        {step === 0 && (q.sourceType === "upload" || q.sourceType === "demo") && (
          <Alert tone="info" title="We filled this in from your document">
            Please compare it with the original. Fields in <span className="font-semibold text-warning-ink">yellow</span> need a closer look, and
            fields in <span className="font-semibold text-danger-ink">red</span> must be filled in before the quotation can be sent.
          </Alert>
        )}

        {step < PREVIEW_STEP && <ReviewChecklist issues={issues} onJump={jumpToField} />}

        {step === 0 && <FlightsStep editor={editor} />}
        {step === 1 && <CustomerPriceStep editor={editor} />}
        {step === PREVIEW_STEP && <PreviewStep editor={editor} />}

        <footer className="sticky bottom-0 z-20 -mx-4 flex items-center justify-between gap-3 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
          <Button variant="secondary" icon={ArrowLeft} onClick={() => goTo(step - 1)} disabled={step === 0}>
            Back
          </Button>
          {step < PREVIEW_STEP && (
            <div className="flex items-center gap-3">
              {step === 1 && blocked && <span className="hidden text-sm text-danger-ink sm:inline">Fix the red items above to continue</span>}
              <Button
                iconRight={ArrowRight}
                onClick={() => goTo(step + 1)}
                disabled={step === 1 && blocked}
              >
                {step === 1 ? "Preview quotation" : "Continue"}
              </Button>
            </div>
          )}
        </footer>
      </div>
    </FieldReviewProvider>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "error")
    return <span className="flex items-center gap-1.5 text-sm text-danger-ink"><CloudOff size={16} /> Not saved</span>;
  if (state === "saving")
    return <span className="flex items-center gap-1.5 text-sm text-ink-muted"><Loader2 size={16} className="animate-spin" /> Saving…</span>;
  return <span className="flex items-center gap-1.5 text-sm text-success-ink"><Check size={16} /> All changes saved</span>;
}
