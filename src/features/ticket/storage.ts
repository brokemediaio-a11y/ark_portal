"use client";

import { createDocumentStore } from "@/lib/document-store";
import { ticketSchema } from "./schema";

/** E-tickets owned and authorized by the server. */
export const ticketStore = createDocumentStore("tickets", ticketSchema);

/** All saved tickets, or null while the page is still loading on the server. */
export const useTicketMap = () => ticketStore.useMap();
