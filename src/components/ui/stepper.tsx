"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export interface StepDef {
  key: string;
  label: string;
  description?: string;
}

interface StepperProps {
  steps: readonly StepDef[];
  current: number;
  /** Highest step the user may jump to. */
  maxReachable: number;
  onSelect: (index: number) => void;
}

export function Stepper({ steps, current, maxReachable, onSelect }: StepperProps) {
  return (
    <nav aria-label="Quotation progress">
      <ol className="flex items-center gap-2 overflow-x-auto pb-1 sm:gap-3">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const reachable = i <= maxReachable;
          return (
            <li key={step.key} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onSelect(i)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "group flex min-w-0 cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors",
                  reachable && !active && "hover:bg-white",
                  !reachable && "cursor-not-allowed opacity-50",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full border-2 text-sm font-semibold transition-colors",
                    active && "border-brand bg-brand text-white",
                    done && "border-success bg-success text-white",
                    !active && !done && "border-line bg-white text-ink-muted",
                  )}
                >
                  {done ? <Check size={16} strokeWidth={3} /> : i + 1}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className={cn("block truncate text-sm font-semibold", active ? "text-ink" : "text-ink-muted")}>
                    {step.label}
                  </span>
                  {step.description && <span className="block truncate text-xs text-ink-faint">{step.description}</span>}
                </span>
              </button>
              {i < steps.length - 1 && <span className={cn("h-0.5 min-w-4 flex-1 rounded", done ? "bg-success" : "bg-line")} aria-hidden />}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-sm font-medium text-ink sm:hidden">
        Step {current + 1} of {steps.length}: {steps[current]?.label}
      </p>
    </nav>
  );
}
