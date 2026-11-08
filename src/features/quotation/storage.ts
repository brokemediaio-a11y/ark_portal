"use client";

import { createLocalStore } from "@/lib/local-store";
import { quotationSchema } from "./schema";

/** Quotations saved in this browser (see createLocalStore). */
export const quotationStore = createLocalStore("ark.quotations.v1", quotationSchema);

/** All saved quotations, or null while the page is still loading on the server. */
export const useQuotationMap = () => quotationStore.useMap();
