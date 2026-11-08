import { handleExtractRequest } from "@/features/extraction/server/extract-route";
import { quotationTask } from "@/features/extraction/server/quotation-task";

export const maxDuration = 120;

/** Supplier quotation file(s) → quotation data for staff to review. */
export function POST(request: Request) {
  return handleExtractRequest(request, quotationTask);
}
