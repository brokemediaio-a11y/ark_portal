"use client";

import { createEmptySegment } from "./factory";
import { reviewQuotation } from "./review";
import type { FlightSegment, Quotation } from "./schema";
import { quotationStore } from "./storage";
import { useDocumentEditor } from "./use-document-editor";

export type { SaveState } from "./use-document-editor";

/** The next leg usually starts where the previous one landed. */
export const segmentAfter = (previous: FlightSegment | undefined): FlightSegment => ({
  ...createEmptySegment(),
  originCode: previous?.destinationCode ?? null,
  originName: previous?.destinationName ?? null,
});

const OPTIONS = {
  save: (q: Quotation) => {
    return quotationStore.save(q);
  },
  review: (q: Quotation) => reviewQuotation(q),
  newSegment: segmentAfter,
};

/** Loads one quotation, applies edits, and autosaves them. */
export function useQuotationEditor(initial: Quotation) {
  const { doc, ...editor } = useDocumentEditor<FlightSegment, Quotation>(initial, OPTIONS);
  return {
    quotation: doc,
    ...editor,
    updateNested: editor.updateNested as <K extends "customer" | "passengers" | "markup">(key: K, patch: Partial<Quotation[K]>) => void,
  };
}

export type QuotationEditor = ReturnType<typeof useQuotationEditor>;
