"use client";

import { Plane, Plus, ReceiptText, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SelectField, TextAreaField, TextField } from "@/components/ui/form-field";
import { FieldGroup, SegmentCard } from "@/features/quotation/components/segment-card";
import { PASSENGER_TYPES, type PassengerType } from "../schema";
import { PASSENGER_TYPE_LABELS } from "../ticket-view";
import type { TicketEditor } from "../use-ticket-editor";

const TYPE_OPTIONS = PASSENGER_TYPES.map((value) => ({ value, label: PASSENGER_TYPE_LABELS[value] }));

/** Everything printed on the e-ticket, grouped the way the PDF shows it. */
export function TicketDetailsStep({ editor }: { editor: TicketEditor }) {
  const { ticket: t, update, updateItem, removeItem, addPassenger, updateSegment, addSegment, removeSegment, moveSegment } = editor;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader icon={ReceiptText} title="Booking" description="The references the traveller and the airline use for this trip." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <TextField label="Booking reference (PNR)" path="bookingReference" value={t.bookingReference} onChange={(v) => update("bookingReference", v)} uppercase placeholder="e.g. HUSWIQ" />
          <TextField label="Airline reference" path="airlineReference" value={t.airlineReference} onChange={(v) => update("airlineReference", v)} uppercase hint="Only if the airline printed its own code." />
          <TextField label="Issue date" path="issueDate" type="date" value={t.issueDate} onChange={(v) => update("issueDate", v)} />
          <TextField label="Issued by" path="issuedBy" value={t.issuedBy} onChange={(v) => update("issuedBy", v)} placeholder="e.g. Turkish Airlines" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon={Users} title="Passengers" description="One row per traveller. Names are printed exactly as you write them here." />
        <CardBody className="space-y-4">
          {t.passengers.map((p, i) => (
            <div key={p.id} className="grid items-start gap-3 rounded-xl border border-line p-3 sm:grid-cols-[2fr_1fr_1fr_1.4fr_auto] sm:p-4">
              <TextField label={`Passenger ${i + 1} name`} path={`passengers.${i}.name`} value={p.name} onChange={(v) => updateItem("passengers", i, { name: v })} placeholder="SURNAME/FIRST NAME" required />
              <SelectField<NonNullable<PassengerType>>
                label="Type"
                path={`passengers.${i}.type`}
                value={p.type}
                options={TYPE_OPTIONS}
                placeholder="Not stated"
                onChange={(v) => updateItem("passengers", i, { type: v ?? null })}
              />
              <TextField label="Date of birth" path={`passengers.${i}.dateOfBirth`} type="date" value={p.dateOfBirth} onChange={(v) => updateItem("passengers", i, { dateOfBirth: v })} />
              <TextField label="E-ticket number" path={`passengers.${i}.ticketNumber`} value={p.ticketNumber} onChange={(v) => updateItem("passengers", i, { ticketNumber: v })} inputMode="numeric" />
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                className="sm:mt-7"
                aria-label={`Remove passenger ${i + 1}`}
                title="Remove passenger"
                disabled={t.passengers.length === 1}
                onClick={() => removeItem("passengers", i)}
              />
            </div>
          ))}
          <Button variant="secondary" icon={Plus} onClick={addPassenger} className="w-full border-dashed">
            Add another passenger
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon={Plane} title="Flights" description="Check each flight against the supplier's ticket. A connection is two flights." />
        <CardBody className="space-y-4 bg-surface/60">
          {t.segments.map((segment, i) => (
            <SegmentCard
              key={segment.id}
              segment={segment}
              index={i}
              total={t.segments.length}
              onChange={(patch) => updateSegment(i, patch)}
              onMove={(dir) => moveSegment(i, dir)}
              onRemove={() => removeSegment(i)}
              extra={
                <FieldGroup title="On the ticket" columns={4}>
                  <TextField label="Departure terminal" path={`segments.${i}.departureTerminal`} value={segment.departureTerminal} onChange={(v) => updateSegment(i, { departureTerminal: v })} />
                  <TextField label="Arrival terminal" path={`segments.${i}.arrivalTerminal`} value={segment.arrivalTerminal} onChange={(v) => updateSegment(i, { arrivalTerminal: v })} />
                  <TextField label="Booking class" path={`segments.${i}.bookingClass`} value={segment.bookingClass} onChange={(v) => updateSegment(i, { bookingClass: v })} uppercase maxLength={3} placeholder="e.g. K" />
                  <TextField label="Status" path={`segments.${i}.bookingStatus`} value={segment.bookingStatus} onChange={(v) => updateSegment(i, { bookingStatus: v })} uppercase placeholder="e.g. OK" />
                </FieldGroup>
              }
            />
          ))}
          <Button variant="secondary" icon={Plus} onClick={addSegment} className="w-full border-dashed">
            Add another flight
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon={ReceiptText} title="Conditions & notes" description="Printed on the e-ticket below the flights." />
        <CardBody className="space-y-5">
          <TextAreaField label="Fare conditions" path="fareConditions" value={t.fareConditions} onChange={(v) => update("fareConditions", v)} hint="Copy refund/change rules only if the supplier printed them." />
          <TextAreaField label="Note to the traveller" path="notes" value={t.notes} onChange={(v) => update("notes", v)} placeholder="Optional" />
          <TextAreaField label="Important information" path="infoText" rows={4} value={t.infoText} onChange={(v) => update("infoText", v)} hint="One point per line." />
          <TextAreaField label="Important information in Dari" path="infoTextDari" rows={4} dir="rtl" value={t.infoTextDari} onChange={(v) => update("infoTextDari", v)} hint="Printed beside the English. One point per line." />
        </CardBody>
      </Card>
    </div>
  );
}
