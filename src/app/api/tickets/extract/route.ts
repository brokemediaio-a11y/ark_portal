import { handleExtractRequest } from "@/features/extraction/server/extract-route";
import { ticketTask } from "@/features/ticket/server/ticket-task";

export const maxDuration = 120;

/** Supplier e-ticket file(s) → ticket data for staff to review before an Ark e-ticket is made. */
export function POST(request: Request) {
  return handleExtractRequest(request, ticketTask);
}
