import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { EXTRACTION_STAGES } from "../use-extraction";

export function ExtractionProgress({ stage }: { stage: number }) {
  const percent = Math.min(95, ((stage + 1) / EXTRACTION_STAGES.length) * 90);
  return (
    <div className="space-y-5" aria-live="polite">
      <div className="h-2 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-brand transition-all duration-700 ease-out" style={{ width: `${percent}%` }} />
      </div>
      <ol className="space-y-3">
        {EXTRACTION_STAGES.map((label, i) => (
          <li key={label} className={cn("flex items-center gap-3 text-sm", i > stage ? "text-ink-faint" : "text-ink")}>
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full",
                i < stage && "bg-success text-white",
                i === stage && "bg-brand-soft text-brand",
                i > stage && "bg-surface",
              )}
            >
              {i < stage ? <Check size={14} strokeWidth={3} /> : i === stage ? <Loader2 size={14} className="animate-spin" /> : null}
            </span>
            <span className={cn(i === stage && "font-medium")}>{label}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-ink-muted">This usually takes 10–30 seconds. You can stay on this page.</p>
    </div>
  );
}
