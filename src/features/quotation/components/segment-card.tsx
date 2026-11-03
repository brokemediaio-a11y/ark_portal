"use client";

import { ArrowDown, ArrowRight, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberField, TextField } from "@/components/ui/form-field";
import { SEGMENT_FIELD_LABELS, segmentField } from "../review";
import type { FlightSegment } from "../schema";

type TextKey = Exclude<keyof FlightSegment, "id" | "stops">;

interface SegmentCardProps {
  segment: FlightSegment;
  index: number;
  total: number;
  onChange: (patch: Partial<FlightSegment>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

interface TextOptions {
  placeholder?: string;
  hint?: string;
  type?: "text" | "date" | "time";
  uppercase?: boolean;
  maxLength?: number;
  required?: boolean;
}

export function SegmentCard({ segment, index, total, onChange, onMove, onRemove }: SegmentCardProps) {
  const text = (key: TextKey, opts: TextOptions = {}) => (
    <TextField
      label={SEGMENT_FIELD_LABELS[key]}
      path={segmentField(index, key)}
      value={segment[key]}
      onChange={(v) => onChange({ [key]: v })}
      {...opts}
    />
  );

  const from = segment.originCode ?? segment.originName;
  const to = segment.destinationCode ?? segment.destinationName;

  return (
    <article className="rounded-2xl border border-line bg-white" aria-label={`Flight ${index + 1}`}>
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <span className="grid size-8 place-items-center rounded-full bg-brand text-sm font-semibold text-white">{index + 1}</span>
        <h3 className="flex min-w-0 flex-1 items-center gap-2 font-semibold text-ink">
          <span className="truncate">{from || "From ?"}</span>
          <ArrowRight size={16} className="shrink-0 text-accent" aria-hidden />
          <span className="truncate">{to || "To ?"}</span>
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" icon={ArrowUp} aria-label="Move flight up" title="Move up" disabled={index === 0} onClick={() => onMove(-1)} />
          <Button variant="ghost" size="sm" icon={ArrowDown} aria-label="Move flight down" title="Move down" disabled={index === total - 1} onClick={() => onMove(1)} />
          <Button variant="danger" size="sm" icon={Trash2} aria-label="Remove this flight" title="Remove flight" disabled={total === 1} onClick={onRemove} />
        </div>
      </header>

      <div className="space-y-5 p-4 sm:p-5">
        <FieldGroup title="Airline">
          {text("airlineName", { placeholder: "e.g. Emirates" })}
          {text("airlineCode", { placeholder: "e.g. EK", uppercase: true, maxLength: 3 })}
          {text("flightNumber", { placeholder: "e.g. EK 623" })}
        </FieldGroup>

        <FieldGroup title="Route" columns={4}>
          {text("originCode", { placeholder: "LHE", uppercase: true, maxLength: 3, required: true })}
          {text("originName", { placeholder: "Lahore" })}
          {text("destinationCode", { placeholder: "DXB", uppercase: true, maxLength: 3, required: true })}
          {text("destinationName", { placeholder: "Dubai" })}
        </FieldGroup>

        <FieldGroup title="Schedule (local times)" columns={4}>
          {text("departureDate", { type: "date", required: true })}
          {text("departureTime", { type: "time" })}
          {text("arrivalDate", { type: "date" })}
          {text("arrivalTime", { type: "time" })}
        </FieldGroup>

        <FieldGroup title="Extras" columns={4}>
          {text("cabin", { placeholder: "e.g. Economy" })}
          <NumberField
            label={SEGMENT_FIELD_LABELS.stops}
            path={segmentField(index, "stops")}
            value={segment.stops}
            onChange={(v) => onChange({ stops: v })}
            integer
            placeholder="0 = non-stop"
          />
          {text("duration", { placeholder: "e.g. 3h 15m" })}
          {text("baggage", { placeholder: "e.g. 30 kg", hint: "Only if the supplier states it." })}
        </FieldGroup>
      </div>
    </article>
  );
}

function FieldGroup({ title, columns = 3, children }: { title: string; columns?: 3 | 4; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2.5 text-xs font-semibold tracking-wide text-ink-faint uppercase">{title}</legend>
      <div className={columns === 4 ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-4" : "grid gap-4 sm:grid-cols-3"}>{children}</div>
    </fieldset>
  );
}
