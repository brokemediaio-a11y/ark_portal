"use client";

import { Baby, Banknote, Lock, NotebookPen, UserRound } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { NumberField, TextAreaField, TextField } from "@/components/ui/form-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { hasYoungTravellers, youngTravellerNames } from "../customer-view";
import { calculatePrice } from "../pricing";
import type { Markup } from "../schema";
import type { QuotationEditor } from "../use-quotation-editor";
import { PriceSummary } from "./price-summary";

const MARKUP_OPTIONS = [
  { value: "fixed", label: "Fixed amount" },
  { value: "percentage", label: "Percentage" },
] as const;

/** Supplier price, markup and the resulting customer price, for everyone or for one group of travellers. */
function PriceFields({ path, sourceTotal, markup, currency, label, onSourceTotal, onMarkup }: {
  path: string;
  sourceTotal: number | null;
  markup: Markup;
  currency: string | null;
  label: string;
  onSourceTotal: (value: number | null) => void;
  onMarkup: (patch: Partial<Markup>) => void;
}) {
  const suffix = currency ?? undefined;
  return (
    <>
      <NumberField label={label} path={path ? `${path}.sourceTotal` : "sourceTotal"} required value={sourceTotal} onChange={onSourceTotal} suffix={suffix} placeholder="0" />
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-ink">Your markup</span>
          <SegmentedControl label="Markup type" value={markup.type} options={MARKUP_OPTIONS} onChange={(type) => onMarkup({ type })} />
        </div>
        <NumberField
          label={markup.type === "percentage" ? "Markup percentage" : "Markup amount"}
          path={path ? `${path}.markup.value` : "markup.value"}
          value={markup.value}
          onChange={(v) => onMarkup({ value: v ?? 0 })}
          suffix={markup.type === "percentage" ? "%" : suffix}
          hint="Added once to this price (not per traveller)."
        />
      </div>
      <PriceSummary price={calculatePrice(sourceTotal, markup, currency)} currency={currency} />
    </>
  );
}

export function CustomerPriceStep({ editor }: { editor: QuotationEditor }) {
  const { quotation: q, update, updateNested } = editor;
  const young = hasYoungTravellers(q.passengers);
  const names = youngTravellerNames(q);

  const setName = (type: "child" | "infant", index: number, value: string | null) => {
    const key = type === "child" ? "childNames" : "infantNames";
    const next = [...q[key]];
    while (next.length <= index) next.push(null);
    next[index] = value;
    update(key, next);
  };

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
            <TextAreaField label="Terms in Dari" path="termsTextDari" rows={4} dir="rtl" value={q.termsTextDari} onChange={(v) => update("termsTextDari", v)} hint="Printed beside the English terms. One term per line." />
          </CardBody>
        </Card>
      </div>

      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader icon={Banknote} title={young ? "Adults' price" : "Price"} description={young ? "What the adults pay. Children and infants are priced below." : "Set what the customer will pay."} />
          <CardBody className="space-y-5">
            <TextField label="Currency" path="currency" required value={q.currency} onChange={(v) => update("currency", v)} uppercase maxLength={3} placeholder="PKR" />
            <PriceFields
              path=""
              label={young ? "Supplier price (adults)" : "Supplier price (total)"}
              sourceTotal={q.sourceTotal}
              markup={q.markup}
              currency={q.currency}
              onSourceTotal={(v) => update("sourceTotal", v)}
              onMarkup={(patch) => updateNested("markup", patch)}
            />
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Lock size={12} aria-hidden /> Supplier prices and markups are never shown to the customer.
            </p>
            {(q.baseAmount !== null || q.taxAmount !== null) && (
              <p className="text-xs text-ink-muted">
                Supplier breakdown: base {q.baseAmount ?? "—"} · taxes {q.taxAmount ?? "—"} {q.currency}
              </p>
            )}
          </CardBody>
        </Card>

        {young && (
          <Card>
            <CardHeader icon={Baby} title="Children & infants" description="Their own price and names, printed on a second price bar." />
            <CardBody className="space-y-5">
              <PriceFields
                path="youngPricing"
                label="Supplier price (all children & infants)"
                sourceTotal={q.youngPricing.sourceTotal}
                markup={q.youngPricing.markup}
                currency={q.currency}
                onSourceTotal={(v) => update("youngPricing", { ...q.youngPricing, sourceTotal: v })}
                onMarkup={(patch) => update("youngPricing", { ...q.youngPricing, markup: { ...q.youngPricing.markup, ...patch } })}
              />
              <div className="space-y-3">
                <p className="text-sm font-medium text-ink">Names</p>
                {names.map((t) => {
                  const index = Number(t.label.split(" ")[1]) - 1;
                  return (
                    <TextField
                      key={t.label}
                      label={`${t.label} name`}
                      path={t.type === "child" ? "childNames" : "infantNames"}
                      value={(t.type === "child" ? q.childNames : q.infantNames)[index] ?? null}
                      onChange={(v) => setName(t.type, index, v)}
                      placeholder="e.g. Ali Khan"
                    />
                  );
                })}
                <p className="text-xs text-ink-muted">Set how many children and infants travel in the Flights step.</p>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
