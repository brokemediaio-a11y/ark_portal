import "server-only";
import { localToday } from "@/lib/dates";
import type { ExtractionMethod } from "../schema";
import { ExtractionError, type ExtractionProvider, type StructuringTask } from "./providers";
import { callProvider, readDocuments, type DocumentsText, type UploadedFile } from "./read-documents";

const AI_TIMEOUT_MS = 110_000;

/** Everything specific to one kind of document (quotation, e-ticket). The reading pipeline is shared. */
export interface ExtractionTask<T> extends StructuringTask<T> {
  /** Whether the AI found anything of this kind in the documents. */
  found: (data: T) => boolean;
  /** Deterministic checks against the document text, run on real (non-demo) results. */
  verify: (data: T, documents: DocumentsText, today: string) => T;
  notFoundMessage: string;
}

export interface ExtractionOutcome<T> {
  data: T;
  method: ExtractionMethod;
  demo: boolean;
}

/**
 * Upload(s) → validated structured data:
 * 1. Read every file (see readDocuments).
 * 2. Structure the text with the AI, in the task's strict JSON schema.
 * 3. Validate the JSON, then run the task's checks against the documents.
 */
export async function extractDocuments<T>(files: UploadedFile[], provider: ExtractionProvider, task: ExtractionTask<T>): Promise<ExtractionOutcome<T>> {
  const signal = AbortSignal.timeout(AI_TIMEOUT_MS);
  const documents = await readDocuments(files, provider, signal);

  const raw = await callProvider(provider, () => provider.extract(documents.source, task, signal));
  const parsed = task.schema.safeParse(raw);
  if (!parsed.success) {
    console.error("[extract] schema validation failed:", parsed.error.issues.length, "issues");
    throw new ExtractionError("ai_failed", "The documents were read but the result didn't look right. Please try again or enter the details manually.", 502);
  }

  const data = provider.isDemo ? parsed.data : task.verify(parsed.data, documents, localToday());
  if (!task.found(data)) throw new ExtractionError("no_flight_details", task.notFoundMessage, 422);

  return {
    data,
    method: provider.isDemo ? "demo" : documents.scanned ? "vision" : "pdf-text",
    demo: provider.isDemo,
  };
}
