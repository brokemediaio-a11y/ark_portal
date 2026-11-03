"use client";

import { Plus, X } from "lucide-react";
import { NumberField } from "@/components/ui/form-field";
import { cn } from "@/lib/cn";

export interface PassengerValues {
  adults: number;
  childAges: number[];
  infantAges: number[];
}

const CHILD_AGES = Array.from({ length: 16 }, (_, i) => i + 2); // 2–17
const INFANT_AGES = [
  { value: 0, label: "Under 1" },
  { value: 1, label: "1 year" },
];

interface PassengerPickerProps {
  value: PassengerValues;
  onChange: (value: PassengerValues) => void;
  error?: string | null;
}

/** Adults as a number; children and infants by age, because fares depend on it. */
export function PassengerPicker({ value, onChange, error }: PassengerPickerProps) {
  const setAges = (key: "childAges" | "infantAges", ages: number[]) => onChange({ ...value, [key]: ages });

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-ink">Travellers</legend>
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr_1fr]">
        <NumberField label="Adults (18+)" integer min={1} value={value.adults} onChange={(v) => onChange({ ...value, adults: Math.max(1, v ?? 1) })} />
        <AgeList
          label="Children (2–17)"
          addLabel="Add child"
          ages={value.childAges}
          options={CHILD_AGES.map((a) => ({ value: a, label: `${a} years` }))}
          defaultAge={8}
          onChange={(ages) => setAges("childAges", ages)}
        />
        <AgeList
          label="Infants (on lap)"
          addLabel="Add infant"
          ages={value.infantAges}
          options={INFANT_AGES}
          defaultAge={0}
          onChange={(ages) => setAges("infantAges", ages)}
        />
      </div>
      {error && <p className="text-xs text-danger-ink">{error}</p>}
    </fieldset>
  );
}

interface AgeListProps {
  label: string;
  addLabel: string;
  ages: number[];
  options: { value: number; label: string }[];
  defaultAge: number;
  onChange: (ages: number[]) => void;
}

function AgeList({ label, addLabel, ages, options, defaultAge, onChange }: AgeListProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-ink">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        {ages.map((age, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-xl border border-line bg-white pr-1 pl-2">
            <select
              aria-label={`${label} ${i + 1} age`}
              value={age}
              onChange={(e) => onChange(ages.map((a, j) => (j === i ? Number(e.target.value) : a)))}
              className="h-9 cursor-pointer bg-transparent text-sm focus:outline-none"
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              type="button"
              aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
              onClick={() => onChange(ages.filter((_, j) => j !== i))}
              className="grid size-7 cursor-pointer place-items-center rounded-lg text-ink-muted hover:bg-surface hover:text-danger"
            >
              <X size={14} />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => onChange([...ages, defaultAge])}
          className={cn(
            "inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-line px-3 text-sm text-ink-muted",
            "hover:border-brand/50 hover:text-brand",
          )}
        >
          <Plus size={14} /> {addLabel}
        </button>
      </div>
    </div>
  );
}
