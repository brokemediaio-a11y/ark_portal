"use client";

import { Plane, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { NumberField, TextAreaField } from "@/components/ui/form-field";
import type { QuotationEditor } from "../use-quotation-editor";
import { SegmentCard } from "./segment-card";

export function FlightsStep({ editor }: { editor: QuotationEditor }) {
  const { quotation: q, updateSegment, moveSegment, removeSegment, addSegment, updateNested, update } = editor;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          icon={Plane}
          title="Flights"
          description="Check each flight against the supplier document. Add one entry per flight — a connection is two flights."
        />
        <CardBody className="space-y-4 bg-surface/60">
          {q.segments.map((segment, i) => (
            <SegmentCard
              key={segment.id}
              segment={segment}
              index={i}
              total={q.segments.length}
              onChange={(patch) => updateSegment(i, patch)}
              onMove={(dir) => moveSegment(i, dir)}
              onRemove={() => removeSegment(i)}
            />
          ))}
          <Button variant="secondary" icon={Plus} onClick={addSegment} className="w-full border-dashed">
            Add another flight
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon={Users} title="Travellers & fare rules" description="Shown on the quotation so the customer knows what's included." />
        <CardBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField label="Adults" path="passengers.adults" integer value={q.passengers.adults} onChange={(v) => updateNested("passengers", { adults: v })} />
            <NumberField label="Children" path="passengers.children" integer value={q.passengers.children} onChange={(v) => updateNested("passengers", { children: v })} placeholder="0" />
            <NumberField label="Infants" path="passengers.infants" integer value={q.passengers.infants} onChange={(v) => updateNested("passengers", { infants: v })} placeholder="0" />
          </div>
          <TextAreaField
            label="Fare conditions"
            path="fareConditions"
            value={q.fareConditions}
            onChange={(v) => update("fareConditions", v)}
            placeholder="e.g. Non-refundable. Date change allowed with fee."
            hint="Copy the refund/change rules only if the supplier provided them."
          />
        </CardBody>
      </Card>
    </div>
  );
}
