"use client";

import { createDocumentStore } from "@/lib/document-store";
import { quotationSchema } from "./schema";

/** Quotations owned and authorized by the server. */
export const quotationStore = createDocumentStore("quotations", quotationSchema);

/** All saved quotations, or null while the page is still loading on the server. */
export const useQuotationMap = () => quotationStore.useMap();
