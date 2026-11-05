"use client";

import { createElement, useEffect, useRef, useState } from "react";
import { brand } from "@/config/brand";
import type { CustomerQuote } from "@/features/quotation/customer-view";

/** Logos already loaded, so the preview doesn't refetch them on every edit. */
const airlineLogoCache = new Map<string, string>();

async function loadAirlineLogo(code: string): Promise<void> {
  if (airlineLogoCache.has(code)) return;
  const res = await fetch(`/api/airlines/${encodeURIComponent(code)}/logo`, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return;
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  airlineLogoCache.set(code, dataUrl);
}

/** Logos for the quote's airlines. One that can't be loaded just shows the airline's code in the PDF. */
async function loadAirlineLogos(quote: CustomerQuote): Promise<Record<string, string>> {
  const codes = [...new Set(quote.segments.map((s) => s.airlineCode).filter((c): c is string => Boolean(c)))];
  await Promise.allSettled(codes.map(loadAirlineLogo));
  return Object.fromEntries(codes.flatMap((code) => (airlineLogoCache.has(code) ? [[code, airlineLogoCache.get(code)!]] : [])));
}

/** Renders the customer view to a PDF Blob. The PDF library is loaded on demand. */
export async function renderQuotationPdf(quote: CustomerQuote): Promise<Blob> {
  const [{ pdf }, { QuotationDocument }, airlineLogos] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./quotation-document"),
    loadAirlineLogos(quote),
  ]);
  const logoSrc = brand.logoPath ? new URL(brand.logoPath, window.location.origin).toString() : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- react-pdf's pdf() expects a Document element
  return pdf(createElement(QuotationDocument, { quote, logoSrc, airlineLogos }) as any).toBlob();
}

interface PdfState {
  url: string | null;
  blob: Blob | null;
  loading: boolean;
  error: string | null;
}

/** Keeps a live PDF preview in sync with the quote, debounced to avoid re-rendering on every keystroke. */
export function useQuotationPdf(quote: CustomerQuote | null, delayMs = 500): PdfState {
  const [state, setState] = useState<PdfState>({ url: null, blob: null, loading: true, error: null });
  const key = quote ? JSON.stringify(quote) : null;

  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const blob = await renderQuotationPdf(JSON.parse(key) as CustomerQuote);
        if (cancelled) return;
        // Keep showing the previous PDF until the new one is ready, then swap.
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = URL.createObjectURL(blob);
        setState({ url: urlRef.current, blob, loading: false, error: null });
      } catch (error) {
        console.error(error);
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: "The PDF could not be created. Please try again." }));
      }
    }, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, delayMs]);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  return state;
}
