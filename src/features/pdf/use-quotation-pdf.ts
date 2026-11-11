"use client";

import { createElement, useEffect, useRef, useState, type ReactElement } from "react";
import { brand } from "@/config/brand";
import type { CustomerQuote } from "@/features/quotation/customer-view";
import type { CustomerTicket } from "@/features/ticket/ticket-view";
import type { PdfLayout } from "./layout";

/** Logos already loaded, so the preview doesn't refetch them on every edit. */
const airlineLogoCache = new Map<string, string>();

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

async function loadAirlineLogo(code: string): Promise<void> {
  if (airlineLogoCache.has(code)) return;
  const res = await fetch(`/api/airlines/${encodeURIComponent(code)}/logo`, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return;
  airlineLogoCache.set(code, await toDataUrl(await res.blob()));
}

/** Logos for the given airlines. One that can't be loaded just shows the airline's code in the PDF. */
async function loadAirlineLogos(codes: (string | null)[]): Promise<Record<string, string>> {
  const unique = [...new Set(codes.filter((c): c is string => Boolean(c)))];
  await Promise.allSettled(unique.map(loadAirlineLogo));
  return Object.fromEntries(unique.flatMap((code) => (airlineLogoCache.has(code) ? [[code, airlineLogoCache.get(code)!]] : [])));
}

/** Everything a branded PDF needs from the site: fonts, the Ark logo and airline logos. */
async function preparePdf(airlineCodes: (string | null)[]) {
  const [{ pdf }, { registerPdfFonts }, airlineLogos] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./brand-frame"),
    loadAirlineLogos(airlineCodes),
  ]);
  registerPdfFonts(new URL(brand.persianFontPath, window.location.origin).toString());
  const logoSrc = new URL(brand.pdfLogoPath, window.location.origin).toString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- react-pdf's pdf() expects a Document element
  const toBlob = (element: ReactElement) => pdf(element as any).toBlob();
  return { airlineLogos, logoSrc, toBlob };
}

/** Renders the customer view of a quotation to a PDF Blob. The PDF library is loaded on demand. */
export async function renderQuotationPdf(quote: CustomerQuote, layout: PdfLayout = "desktop"): Promise<Blob> {
  const [{ QuotationDocument }, { airlineLogos, logoSrc, toBlob }] = await Promise.all([
    import("./quotation-document"),
    preparePdf(quote.segments.map((s) => s.airlineCode)),
  ]);
  return toBlob(createElement(QuotationDocument, { quote, logoSrc, airlineLogos, layout }));
}

/** Renders an Ark e-ticket to a PDF Blob. */
export async function renderTicketPdf(ticket: CustomerTicket, layout: PdfLayout = "desktop"): Promise<Blob> {
  const [{ TicketDocument }, { airlineLogos, logoSrc, toBlob }] = await Promise.all([
    import("./ticket-document"),
    preparePdf(ticket.segments.map((s) => s.airlineCode)),
  ]);
  return toBlob(createElement(TicketDocument, { ticket, logoSrc, airlineLogos, layout }));
}

export interface PdfState {
  url: string | null;
  blob: Blob | null;
  loading: boolean;
  error: string | null;
}

/** Keeps a live PDF preview in sync with its data, debounced to avoid re-rendering on every keystroke. */
export function usePdfPreview<T>(data: T | null, render: (data: T) => Promise<Blob>, delayMs = 500): PdfState {
  const [state, setState] = useState<PdfState>({ url: null, blob: null, loading: true, error: null });
  const key = data ? JSON.stringify(data) : null;
  const renderRef = useRef(render);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    renderRef.current = render;
  });

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const blob = await renderRef.current(JSON.parse(key) as T);
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

const renderQuotationLayout = ({ data, layout }: { data: CustomerQuote; layout: PdfLayout }) => renderQuotationPdf(data, layout);
const renderTicketLayout = ({ data, layout }: { data: CustomerTicket; layout: PdfLayout }) => renderTicketPdf(data, layout);

/** Live preview of a quotation in the chosen layout: what is shown is exactly what gets downloaded. */
export const useQuotationPdf = (quote: CustomerQuote | null, layout: PdfLayout = "desktop") =>
  usePdfPreview(quote ? { data: quote, layout } : null, renderQuotationLayout);

/** Live preview of an e-ticket in the chosen layout. */
export const useTicketPdf = (ticket: CustomerTicket | null, layout: PdfLayout = "desktop") =>
  usePdfPreview(ticket ? { data: ticket, layout } : null, renderTicketLayout);
