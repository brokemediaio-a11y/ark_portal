"use client";

import { createLocalStore } from "@/lib/local-store";
import { ticketSchema } from "./schema";

/** E-tickets saved in this browser (see createLocalStore). */
export const ticketStore = createLocalStore("ark.tickets.v1", ticketSchema);

/** All saved tickets, or null while the page is still loading on the server. */
export const useTicketMap = () => ticketStore.useMap();
