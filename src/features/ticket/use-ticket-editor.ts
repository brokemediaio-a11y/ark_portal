"use client";

import { useDocumentEditor } from "@/features/quotation/use-document-editor";
import { createEmptyPassenger, createEmptyTicketSegment } from "./factory";
import { reviewTicket } from "./review";
import type { Ticket, TicketSegment } from "./schema";
import { ticketStore } from "./storage";

const OPTIONS = {
  save: (t: Ticket) => {
    ticketStore.save(t);
  },
  review: (t: Ticket) => reviewTicket(t),
  /** The next leg usually starts where the previous one landed. */
  newSegment: (previous: TicketSegment | undefined): TicketSegment => ({
    ...createEmptyTicketSegment(),
    originCode: previous?.destinationCode ?? null,
    originName: previous?.destinationName ?? null,
  }),
};

/** Loads one e-ticket, applies edits, and autosaves them. */
export function useTicketEditor(initial: Ticket) {
  const { doc, ...editor } = useDocumentEditor<TicketSegment, Ticket>(initial, OPTIONS);
  return {
    ticket: doc,
    ...editor,
    addPassenger: () => editor.addItem("passengers", createEmptyPassenger()),
  };
}

export type TicketEditor = ReturnType<typeof useTicketEditor>;
