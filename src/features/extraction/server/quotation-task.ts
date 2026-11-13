import "server-only";
import { extractionSchema, type Extraction } from "../schema";
import { resolveAssumedYears } from "./assumed-years";
import { orderFlightsAcrossDocuments, orderFlightsBySource } from "./flight-order";
import type { ExtractionTask } from "./extract-service";
import { groundInSourceText } from "./grounding";
import { buildQuotationSystemPrompt, QUOTATION_USER_INSTRUCTION } from "./prompt";
import { DEMO_EXTRACTION } from "./quotation-demo";
import { amountInSource } from "./source-match";
import { checkAgainstReads, checkItinerary, disagreement, dropFlagsOnEmptyValues, mergeRepeatedFlights, withFlags } from "./verification";

/**
 * Supplier quotation → quotation data. After the AI answers:
 * merge repeated flights, remove what isn't printed, flag what both readings of a
 * scan don't support, resolve missing years, then flag impossible itineraries.
 */
export const quotationTask: ExtractionTask<Extraction> = {
  name: "flight_quotation",
  schema: extractionSchema,
  systemPrompt: buildQuotationSystemPrompt,
  userInstruction: QUOTATION_USER_INSTRUCTION,
  demo: DEMO_EXTRACTION,
  found: (data) => data.documentHasFlightDetails && data.segments.length > 0,
  notFoundMessage: "We couldn't find any flight details in these documents. Are they the right files?",
  verify(raw, documents, today) {
    let data = groundInSourceText(mergeRepeatedFlights(dropFlagsOnEmptyValues(raw)), documents.source);
    if (documents.reads) {
      const reads = documents.reads;
      data = checkAgainstReads(data, reads);
      if (data.totalAmount !== null && !reads.every((read) => amountInSource(data.totalAmount!, read)))
        data = withFlags(data, [disagreement("sourceTotal", String(data.totalAmount))]);
    }
    return withFlags(checkItinerary(orderFlightsAcrossDocuments(orderFlightsBySource(resolveAssumedYears(data, today, documents.source), documents.source), documents.source)), []);
  },
};
