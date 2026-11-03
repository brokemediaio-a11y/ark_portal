"use client";

import { AlertCircle, AlertTriangle, ChevronRight, CircleCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ReviewIssue } from "../review";

interface ReviewChecklistProps {
  issues: ReviewIssue[];
  onJump: (field: string) => void;
  className?: string;
}

/** Everything that still needs attention, with one-click jumps to the field. */
export function ReviewChecklist({ issues, onJump, className }: ReviewChecklistProps) {
  const blocking = issues.filter((i) => i.level === "blocking");
  const warnings = issues.filter((i) => i.level === "warning");

  if (!issues.length) {
    return (
      <div className={cn("flex items-center gap-3 rounded-xl border border-success/25 bg-success-soft p-4 text-sm text-success-ink", className)}>
        <CircleCheck size={20} className="shrink-0" />
        <span className="font-medium">Everything looks complete. You can preview and send the quotation.</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {blocking.length > 0 && (
        <IssueGroup tone="blocking" title={`${blocking.length} thing${blocking.length > 1 ? "s" : ""} to fix before sending`} issues={blocking} onJump={onJump} />
      )}
      {warnings.length > 0 && (
        <IssueGroup tone="warning" title={`${warnings.length} thing${warnings.length > 1 ? "s" : ""} worth a quick check`} issues={warnings} onJump={onJump} />
      )}
    </div>
  );
}

function IssueGroup({ tone, title, issues, onJump }: { tone: "blocking" | "warning"; title: string; issues: ReviewIssue[]; onJump: (f: string) => void }) {
  const Icon = tone === "blocking" ? AlertCircle : AlertTriangle;
  return (
    <details open={tone === "blocking"} className={cn("group rounded-xl border", tone === "blocking" ? "border-danger/25 bg-danger-soft" : "border-warning/30 bg-warning-soft")}>
      <summary className={cn("flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold", tone === "blocking" ? "text-danger-ink" : "text-warning-ink")}>
        <Icon size={18} className="shrink-0" />
        <span className="flex-1">{title}</span>
        <ChevronRight size={16} className="transition-transform group-open:rotate-90" />
      </summary>
      <ul className="space-y-0.5 px-2 pb-2">
        {issues.map((issue, i) => (
          <li key={`${issue.field}-${i}`}>
            <button
              type="button"
              onClick={() => onJump(issue.field)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-ink hover:bg-white/70"
            >
              <span className="flex-1">{issue.message}</span>
              <span className="shrink-0 text-xs font-medium text-brand">Go to field →</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
