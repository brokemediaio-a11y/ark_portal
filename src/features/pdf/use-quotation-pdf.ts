"use client";

import { createElement, useEffect, useRef, useState } from "react";
import { brand } from "@/config/brand";
import type { CustomerQuote } from "@/features/quotation/customer-view";

/** Renders the customer view to a PDF Blob. The PDF library is loaded on demand. */
export async function renderQuotationPdf(quote: CustomerQuote): Promise<Blob> {
  const [{ pdf }, { QuotationDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./quotation-document"),
  ]);
  const logoSrc = brand.logoPath ? new URL(brand.logoPath, window.location.origin).toString() : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- react-pdf's pdf() expects a Document element
  return pdf(createElement(QuotationDocument, { quote, logoSrc }) as any).toBlob();
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
