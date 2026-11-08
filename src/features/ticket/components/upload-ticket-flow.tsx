"use client";

import { DocumentUploadFlow } from "@/features/extraction/components/document-upload-flow";
import type { TicketExtraction } from "../extraction-schema";
import { createEmptyTicket, ticketFromExtraction } from "../factory";
import { ticketStore } from "../storage";

/** Supplier e-ticket(s), in any format → one standard Ark e-ticket. */
export function UploadTicketFlow() {
  return (
    <DocumentUploadFlow<TicketExtraction>
      title="Convert a ticket"
      intro="Upload the airline's or supplier's e-ticket, in any format, and we'll turn it into an Ark Travelers e-ticket. Add every page or file of one booking (for example one ticket per family member): they become one e-ticket. You'll check every detail before downloading."
      documentLabel="the supplier ticket"
      dropLabel="Drag the supplier ticket(s) here"
      endpoint="/api/tickets/extract"
      onExtracted={(result, files) => {
        const ticket = ticketFromExtraction(result.data, { fileNames: files.map((f) => f.name), demo: result.demo });
        ticketStore.save(ticket);
        return `/tickets/${ticket.id}`;
      }}
      onManual={() => {
        const ticket = createEmptyTicket("manual");
        ticketStore.save(ticket);
        return `/tickets/${ticket.id}`;
      }}
      manualText="You can still make an e-ticket. Type in the passengers and flights yourself."
    />
  );
}
