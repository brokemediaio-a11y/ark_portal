"use client";

import { createEmptyQuotation, quotationFromExtraction } from "@/features/quotation/factory";
import { quotationStore } from "@/features/quotation/storage";
import type { Extraction } from "../schema";
import { DocumentUploadFlow } from "./document-upload-flow";

/** Supplier quotation(s) → one Ark quotation. */
export function UploadQuotationFlow() {
  return (
    <DocumentUploadFlow<Extraction>
      title="Create a quotation"
      intro="Upload the supplier's quotation and we'll fill in the flight details for you. Add several PDFs or screenshots if the flights are in different files: they become one quotation. You'll be able to check and change everything, including the price, before anything is sent."
      documentLabel="the supplier quotation"
      dropLabel="Drag the supplier quotation(s) here"
      endpoint="/api/quotations/extract"
      onExtracted={(result, files) => {
        const quotation = quotationFromExtraction(result.data, { fileName: files.map((f) => f.name).join(", "), demo: result.demo });
        quotationStore.save(quotation);
        return `/quotations/${quotation.id}`;
      }}
      onManual={() => {
        const quotation = createEmptyQuotation("manual");
        quotationStore.save(quotation);
        return `/quotations/${quotation.id}`;
      }}
      manualText="You can still make a quotation. Type in the flights and price yourself."
    />
  );
}
