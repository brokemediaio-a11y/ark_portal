"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { FlaskConical, RotateCcw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { quotationFromFlightOffer } from "@/features/quotation/factory";
import { formatMoney } from "@/features/quotation/pricing";
import { quotationStore } from "@/features/quotation/storage";
import type { FlightOffer, OfferResponse } from "../schema";
import { useFlightSearch } from "../use-flight-search";
import { useOfferSelection, type SelectionState } from "../use-offer-selection";
import { FlightResults } from "./flight-results";
import { FlightSearchForm, INITIAL_SEARCH_VALUES, type FlightSearchFormValues } from "./flight-search-form";

function sliceLabelsFor(values: FlightSearchFormValues, count: number): string[] {
  if (values.tripType === "return") return ["Outbound", "Return"];
  if (values.tripType === "oneway") return ["Outbound"];
  return Array.from({ length: count }, (_, i) => `Flight ${i + 1}`);
}

export function FlightSearchFlow() {
  const router = useRouter();
  const { state, search } = useFlightSearch();
  const [values, setValues] = useState(INITIAL_SEARCH_VALUES);

  const createQuotation = useCallback(
    (latest: Extract<OfferResponse, { ok: true }>) => {
      const p = values.passengers;
      const quotation = quotationFromFlightOffer(latest.offer, {
        providerLabel: latest.provider.label,
        refreshedAt: latest.refreshedAt,
        passengers: {
          adults: p.adults,
          children: p.childAges.length || null,
          infants: p.infantAges.length || null,
        },
      });
      quotationStore.save(quotation);
      router.push(`/quotations/${quotation.id}`);
    },
    [values.passengers, router],
  );

  const selection = useOfferSelection(createQuotation);
  const result = state.status === "success" ? state.result : null;
  const sliceLabels = useMemo(() => sliceLabelsFor(values, result?.offers[0]?.slices.length ?? 1), [values, result]);
  const busyOfferId = selection.state.status === "checking" ? selection.state.offer.id : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand sm:text-3xl">Search flights</h1>
        <p className="mt-1 text-ink-muted">Search live airline fares, choose an itinerary, and turn it into a branded quotation.</p>
      </div>

      <Card>
        <CardBody>
          <FlightSearchForm
            initial={values}
            loading={state.status === "loading"}
            serverError={state.status === "error" ? { field: state.field, message: state.error } : null}
            onSearch={(request, formValues) => {
              setValues(formValues);
              selection.reset();
              search(request);
            }}
          />
        </CardBody>
      </Card>

      {state.status === "error" && !state.field && (
        <Alert
          tone="error"
          title="The flight search didn't work"
          actions={state.code !== "not_configured" ? <Button size="sm" icon={RotateCcw} onClick={() => search(state.request)}>Try again</Button> : undefined}
        >
          {state.error}
        </Alert>
      )}

      {state.status === "loading" && <ResultsSkeleton />}

      {result && (
        <>
          {!result.provider.liveMode && (
            <Alert tone="warning" title="TEST MODE — these are not real fares">
              Results come from the flight provider&apos;s test environment. Airlines, prices and availability are for demonstration only and
              can&apos;t be sold to customers. Quotations created from them are watermarked &ldquo;TEST MODE&rdquo;.
            </Alert>
          )}

          <SelectionAlert
            state={selection.state}
            onRetry={(offer) => selection.select(offer)}
            onSearchAgain={() => state.status === "success" && search(state.request)}
            onAccept={selection.acceptNewPrice}
            onDismiss={selection.reset}
          />

          <FlightResults
            // A new search starts with fresh filters: old ones could hide every new result.
            key={result.offerRequestId}
            offers={result.offers}
            totalFound={result.totalFound}
            sliceLabels={sliceLabels}
            busyOfferId={busyOfferId}
            onSelect={(offer) => selection.select(offer)}
          />

          <p className="flex items-center gap-1.5 text-xs text-ink-faint">
            <FlaskConical size={13} aria-hidden /> Fares from {result.provider.label}, searched {new Date(result.searchedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.
            Prices are re-checked with the airline when you select a flight.
          </p>
        </>
      )}
    </div>
  );
}

interface SelectionAlertProps {
  state: SelectionState;
  onRetry: (offer: FlightOffer) => void;
  onSearchAgain: () => void;
  onAccept: () => void;
  onDismiss: () => void;
}

/** Outcome of re-pricing the selected fare: expired, failed, or price changed. */
function SelectionAlert({ state, onRetry, onSearchAgain, onAccept, onDismiss }: SelectionAlertProps) {
  if (state.status === "error") {
    return (
      <Alert
        tone="error"
        title={state.expired ? "This fare has expired" : "We couldn't confirm this fare"}
        actions={
          state.expired ? (
            <Button size="sm" icon={RotateCcw} onClick={onSearchAgain}>Search again</Button>
          ) : (
            <Button size="sm" onClick={() => onRetry(state.offer)}>Try again</Button>
          )
        }
      >
        {state.error}
      </Alert>
    );
  }
  if (state.status === "price_changed") {
    const { previous, latest } = state;
    return (
      <Alert
        tone="warning"
        title="The price has changed"
        actions={
          <>
            <Button size="sm" onClick={onAccept}>Use the new price</Button>
            <Button size="sm" variant="secondary" onClick={onDismiss}>Back to results</Button>
          </>
        }
      >
        The airline now charges <strong>{formatMoney(latest.offer.totalAmount, latest.offer.totalCurrency)}</strong> instead of{" "}
        {formatMoney(previous.totalAmount, previous.totalCurrency)} for this itinerary.
      </Alert>
    );
  }
  return null;
}

function ResultsSkeleton() {
  return (
    <div className="space-y-3" aria-live="polite" aria-busy="true">
      <p className="text-sm text-ink-muted">Asking the airlines for fares — this can take up to 20 seconds…</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-2xl bg-white" />
      ))}
    </div>
  );
}
