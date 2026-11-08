"use client";

import { ArrowLeft, ArrowRight, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { FieldReviewProvider, type FieldReview } from "@/components/ui/form-field";
import { Stepper, type StepDef } from "@/components/ui/stepper";
import { focusField, SaveIndicator } from "@/features/quotation/components/quotation-workspace";
import { ReviewChecklist } from "@/features/quotation/components/review-checklist";
import { StatusBadge } from "@/features/quotation/components/status-badge";
import { hasBlockingIssues } from "@/features/quotation/review";
import type { Ticket } from "../schema";
import { useTicketEditor } from "../use-ticket-editor";
import { TicketDetailsStep } from "./ticket-details-step";
import { TicketPreviewStep } from "./ticket-preview-step";

const STEPS: readonly StepDef[] = [
  { key: "details", label: "Check the ticket", description: "Passengers, flights, references" },
  { key: "preview", label: "Preview & send", description: "Download the Ark e-ticket" },
];
const PREVIEW_STEP = 1;

export function TicketWorkspace({ initial }: { initial: Ticket }) {
  const editor = useTicketEditor(initial);
  const { ticket: t, issues, issueMap, saveState, dismissFlag } = editor;
  const [step, setStep] = useState(0);
  const blocked = hasBlockingIssues(issues);

  const review = useMemo<FieldReview>(
    () => ({
      issuesFor: (path) => issueMap.get(path) ?? [],
      evidenceFor: (path) => t.reviewFlags.find((f) => f.field === path)?.evidence ?? null,
      isFlagged: (path) => t.reviewFlags.some((f) => f.field === path),
      confirm: dismissFlag,
    }),
    [issueMap, t.reviewFlags, dismissFlag],
  );

  const goTo = (index: number) => {
    setStep(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <FieldReviewProvider value={review}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <ButtonLink href="/tickets" variant="ghost" size="sm" icon={ArrowLeft} className="-ml-3 mb-1">
              My tickets
            </ButtonLink>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-ink">
              E-ticket {t.bookingReference ?? t.ticketRef}
              <StatusBadge status={t.status} />
              {t.sourceType === "demo" && <Badge tone="danger">DEMO DATA</Badge>}
            </h1>
            {t.sourceFileNames.length > 0 && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                <FileText size={14} aria-hidden /> From {t.sourceFileNames.join(", ")}
              </p>
            )}
          </div>
          <SaveIndicator state={saveState} />
        </div>

        {t.sourceType === "demo" && (
          <Alert tone="warning" title="This is demo data">
            AI extraction is running in demo mode, so these details were not read from your file. Don&apos;t send this to a traveller.
          </Alert>
        )}

        <div className="rounded-2xl border border-line bg-white/60 p-3">
          <Stepper steps={STEPS} current={step} maxReachable={blocked ? 0 : PREVIEW_STEP} onSelect={goTo} />
        </div>

        {step === 0 && t.sourceType === "upload" && (
          <Alert tone="info" title="We filled this in from the supplier's ticket">
            Please compare it with the original. Fields in <span className="font-semibold text-warning-ink">yellow</span> need a closer look, and
            fields in <span className="font-semibold text-danger-ink">red</span> must be filled in before the e-ticket can be made. Values that
            weren&apos;t printed on the original are left empty rather than guessed.
          </Alert>
        )}

        {step === 0 && (
          <>
            <ReviewChecklist issues={issues} onJump={focusField} />
            <TicketDetailsStep editor={editor} />
          </>
        )}
        {step === PREVIEW_STEP && <TicketPreviewStep editor={editor} />}

        <footer className="sticky bottom-0 z-20 -mx-4 flex items-center justify-between gap-3 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
          <Button variant="secondary" icon={ArrowLeft} onClick={() => goTo(step - 1)} disabled={step === 0}>
            Back
          </Button>
          {step === 0 && (
            <div className="flex items-center gap-3">
              {blocked && <span className="hidden text-sm text-danger-ink sm:inline">Fix the red items above to continue</span>}
              <Button iconRight={ArrowRight} onClick={() => goTo(PREVIEW_STEP)} disabled={blocked}>
                Preview e-ticket
              </Button>
            </div>
          )}
        </footer>
      </div>
    </FieldReviewProvider>
  );
}
