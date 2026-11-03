"use client";

import { Banknote, Lock, NotebookPen, UserRound } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { NumberField, TextAreaField, TextField } from "@/components/ui/form-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { calculatePrice } from "../pricing";
import type { QuotationEditor } from "../use-quotation-editor";
import { PriceSummary } from "./price-summary";

const MARKUP_OPTIONS = [
  { value: "fixed", label: "Fixed amount" },
  { value: "percentage", label: "Percentage" },
] as const;

export function CustomerPriceStep({ editor }: { editor: QuotationEditor }) {
  const { quotation: q, update, updateNested } = editor;
  const price = calculatePrice(q.sourceTotal, q.markup, q.currency);
  const currencySuffix = q.currency ?? undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <Card>
          <CardHeader icon={UserRound} title="Customer" description="Who is this quotation for? All optional." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <TextField className="sm:col-span-2" label="Customer name" path="customer.name" value={q.customer.name} onChange={(v) => updateNested("customer", { name: v })} placeholder="e.g. Mr. Ahmed Khan" autoComplete="off" />
            <TextField label="Email" type="email" path="customer.email" value={q.customer.email} onChange={(v) => updateNested("customer", { email: v })} placeholder="name@example.com" />
            <TextField
              label="WhatsApp / phone"
              type="tel"
              path="customer.phone"
              value={q.customer.phone}
              onChange={(v) => updateNested("customer", { phone: v })}
              placeholder="+92 300 1234567"
              hint="Include the country code to send via WhatsApp."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={NotebookPen} title="Notes & terms" description="Printed at the bottom of the quotation." />
          <CardBody className="space-y-4">
            <TextAreaField label="Note to the customer" path="notes" value={q.notes} onChange={(v) => update("notes", v)} placeholder="e.g. Seats are limited at this fare — please confirm soon." />
            <TextAreaField label="Terms" path="termsText" rows={4} value={q.termsText} onChange={(v) => update("termsText", v)} hint="One term per line." />
          </CardBody>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Card className="lg:sticky lg:top-24">
          <CardHeader icon={Banknote} title="Price" description="Set what the customer will pay." />
          <CardBody className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <TextField
                label="Currency"
                path="currency"
                required
                value={q.currency}
                onChange={(v) => update("currency", v)}
                uppercase
                maxLength={3}
                placeholder="PKR"
              />
              <NumberField
                className="col-span-2"
                label="Supplier price (total)"
                path="sourceTotal"
                required
                value={q.sourceTotal}
                onChange={(v) => update("sourceTotal", v)}
                suffix={currencySuffix}
                placeholder="0"
              />
            </div>
            <p className="-mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
              <Lock size={12} aria-hidden /> Supplier price and markup are never shown to the customer.
            </p>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">Your markup</span>
                <SegmentedControl
                  label="Markup type"
                  value={q.markup.type}
                  options={MARKUP_OPTIONS}
                  onChange={(type) => updateNested("markup", { type })}
                />
              </div>
              <NumberField
                label={q.markup.type === "percentage" ? "Markup percentage" : "Markup amount"}
                path="markup.value"
                value={q.markup.value}
                onChange={(v) => updateNested("markup", { value: v ?? 0 })}
                suffix={q.markup.type === "percentage" ? "%" : currencySuffix}
                hint="Added once to the total price (not per traveller)."
              />
            </div>

            <PriceSummary price={price} currency={q.currency} />

            {(q.baseAmount !== null || q.taxAmount !== null) && (
              <p className="text-xs text-ink-muted">
                Supplier breakdown: base {q.baseAmount ?? "—"} · taxes {q.taxAmount ?? "—"} {q.currency}
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
