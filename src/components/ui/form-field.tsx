"use client";

import { AlertCircle, AlertTriangle, Check } from "lucide-react";
import { createContext, useContext, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ---------- Review context: lets any field find its own issues by path ---------- */

export interface FieldIssue {
  level: "blocking" | "warning";
  message: string;
}

export interface FieldReview {
  issuesFor(path: string): FieldIssue[];
  evidenceFor(path: string): string | null;
  /** Present when the field has an AI flag that staff can mark as checked. */
  confirm?(path: string): void;
  isFlagged(path: string): boolean;
}

const FieldReviewContext = createContext<FieldReview | null>(null);
export const FieldReviewProvider = FieldReviewContext.Provider;

export type FieldTone = "default" | "warning" | "error";

function useFieldReview(path?: string, error?: string | null) {
  const review = useContext(FieldReviewContext);
  const issues = [
    ...(error ? [{ level: "blocking" as const, message: error }] : []),
    ...(path && review ? review.issuesFor(path) : []),
  ];
  const tone: FieldTone = issues.some((i) => i.level === "blocking")
    ? "error"
    : issues.length
      ? "warning"
      : "default";
  return {
    issues,
    tone,
    evidence: path && review ? review.evidenceFor(path) : null,
    onConfirm: path && review?.confirm && review.isFlagged(path) ? () => review.confirm!(path) : undefined,
  };
}

/* ---------- Shell ---------- */

export const controlClasses = (tone: FieldTone, className?: string) =>
  cn(
    "block w-full rounded-xl border bg-white px-3.5 text-sm text-ink placeholder:text-ink-faint transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-offset-0",
    tone === "error" && "border-danger/60 bg-danger-soft/40 focus:ring-danger/30",
    tone === "warning" && "border-warning/70 bg-warning-soft/50 focus:ring-warning/30",
    tone === "default" && "border-line focus:border-brand/60 focus:ring-brand/20",
    className,
  );

interface ShellProps {
  label: string;
  path?: string;
  hint?: ReactNode;
  required?: boolean;
  /** A validation message from the surrounding form (in addition to review issues). */
  error?: string | null;
  className?: string;
  children: (control: { id: string; describedBy?: string; tone: FieldTone }) => ReactNode;
}

export function FieldShell({ label, path, hint, required, error, className, children }: ShellProps) {
  const id = useId();
  const { issues, tone, evidence, onConfirm } = useFieldReview(path, error);
  const messageId = `${id}-msg`;
  const hasMessage = Boolean(hint || issues.length || evidence);

  return (
    <div className={cn("space-y-1.5", className)} data-field={path}>
      <label htmlFor={id} className="flex items-center gap-1 text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger" aria-label="required">*</span>}
      </label>
      {children({ id, describedBy: hasMessage ? messageId : undefined, tone })}
      {hasMessage && (
        <div id={messageId} className="space-y-1 text-xs">
          {issues.map((issue, i) => (
            <p
              key={i}
              className={cn(
                "flex items-start gap-1",
                issue.level === "blocking" ? "text-danger-ink" : "text-warning-ink",
              )}
            >
              {issue.level === "blocking" ? <AlertCircle size={14} className="mt-px shrink-0" /> : <AlertTriangle size={14} className="mt-px shrink-0" />}
              <span>{issue.message}</span>
            </p>
          ))}
          {evidence && <p className="text-ink-muted">Document says: “{evidence}”</p>}
          {onConfirm && (
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-success-ink hover:bg-success-soft"
            >
              <Check size={14} /> I&apos;ve checked this
            </button>
          )}
          {hint && !issues.length && <p className="text-ink-muted">{hint}</p>}
        </div>
      )}
    </div>
  );
}

/* ---------- Concrete fields ---------- */

type BaseFieldProps = Omit<ShellProps, "children">;

interface TextFieldProps extends BaseFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "date" | "time";
  uppercase?: boolean;
  maxLength?: number;
  autoComplete?: string;
  inputMode?: ComponentProps<"input">["inputMode"];
  /** For date/time inputs. */
  min?: string;
  max?: string;
}

export function TextField({ value, onChange, placeholder, type = "text", uppercase, maxLength, autoComplete, inputMode, min, max, ...shell }: TextFieldProps) {
  return (
    <FieldShell {...shell}>
      {({ id, describedBy, tone }) => (
        <input
          id={id}
          type={type}
          value={value ?? ""}
          placeholder={placeholder}
          maxLength={maxLength}
          min={min}
          max={max}
          autoComplete={autoComplete ?? "off"}
          inputMode={inputMode}
          aria-describedby={describedBy}
          aria-invalid={tone === "error" || undefined}
          onChange={(e) => {
            const next = uppercase ? e.target.value.toUpperCase() : e.target.value;
            onChange(next === "" ? null : next);
          }}
          className={controlClasses(tone, cn("h-11", uppercase && "uppercase"))}
        />
      )}
    </FieldShell>
  );
}

interface NumberFieldProps extends BaseFieldProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  min?: number;
  step?: number | "any";
  integer?: boolean;
  suffix?: string;
}

export function NumberField({ value, onChange, placeholder, min = 0, step = "any", integer, suffix, ...shell }: NumberFieldProps) {
  return (
    <FieldShell {...shell}>
      {({ id, describedBy, tone }) => (
        <div className="relative">
          <input
            id={id}
            type="number"
            inputMode={integer ? "numeric" : "decimal"}
            value={value ?? ""}
            min={min}
            step={integer ? 1 : step}
            placeholder={placeholder}
            aria-describedby={describedBy}
            aria-invalid={tone === "error" || undefined}
            onChange={(e) => {
              if (e.target.value === "") return onChange(null);
              const n = integer ? parseInt(e.target.value, 10) : parseFloat(e.target.value);
              if (Number.isFinite(n)) onChange(Math.max(min, n));
            }}
            onWheel={(e) => e.currentTarget.blur()}
            className={controlClasses(tone, cn("h-11 tabular-nums", suffix && "pr-14"))}
          />
          {suffix && (
            <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-ink-muted">
              {suffix}
            </span>
          )}
        </div>
      )}
    </FieldShell>
  );
}

interface SelectFieldProps<T extends string> extends BaseFieldProps {
  value: T | null;
  onChange: (value: T | null) => void;
  options: readonly { value: T; label: string }[];
  placeholder?: string;
}

export function SelectField<T extends string>({ value, onChange, options, placeholder = "Select…", ...shell }: SelectFieldProps<T>) {
  return (
    <FieldShell {...shell}>
      {({ id, describedBy, tone }) => (
        <select
          id={id}
          value={value ?? ""}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value === "" ? null : (e.target.value as T))}
          className={controlClasses(tone, "h-11 pr-8")}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

interface TextAreaFieldProps extends BaseFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  rows?: number;
}

export function TextAreaField({ value, onChange, placeholder, rows = 3, ...shell }: TextAreaFieldProps) {
  return (
    <FieldShell {...shell}>
      {({ id, describedBy, tone }) => (
        <textarea
          id={id}
          rows={rows}
          value={value ?? ""}
          placeholder={placeholder}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
          className={controlClasses(tone, "py-2.5 leading-relaxed")}
        />
      )}
    </FieldShell>
  );
}
