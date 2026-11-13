import "server-only";
import { localToday } from "@/lib/dates";
import type { ExtractedSegment, ExtractionMethod, ItineraryExtraction } from "../schema";
import { ExtractionError, type ExtractionProvider, type StructuringTask } from "./providers";
import { callProvider, readDocuments, type DocumentsText, type UploadedFile } from "./read-documents";
import { dateInSource, flightNumberInSource, hasClockTime, hasDate, timeInSource } from "./source-match";

const AI_TIMEOUT_MS = 110_000;

/** Everything specific to one kind of document (quotation, e-ticket). The reading pipeline is shared. */
export interface ExtractionTask<T extends ItineraryExtraction> extends StructuringTask<T> {
  /** Whether the AI found anything of this kind in the documents. */
  found: (data: T) => boolean;
  /** Deterministic checks against the document text, run on real (non-demo) results. */
  verify: (data: T, documents: DocumentsText, today: string) => T;
  /** Whether the result is missing something this one file prints besides its flights (e.g. a ticket number). */
  missesFromDocument?: (data: T, text: string) => boolean;
  /** Adds what a separately re-read file found besides its flights (e.g. its passengers). Flights are merged for every task. */
  mergeDocument?: (data: T, extra: T) => T;
  notFoundMessage: string;
}

export interface ExtractionOutcome<T> {
  data: T;
  method: ExtractionMethod;
  demo: boolean;
}

/** Does one of these flights come from this file? By its flight number, or by its departure date and time. */
const coversDocument = (segments: readonly ExtractedSegment[], text: string) =>
  segments.some((s) =>
    (s.flightNumber && flightNumberInSource(s.flightNumber, text)) ||
    (s.departureDate && s.departureTime && dateInSource(s.departureDate, text) && timeInSource(s.departureTime, text)));

const flightKey = (s: ExtractedSegment) => `${(s.flightNumber ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")}|${s.departureDate ?? ""}`;

/** Appends a re-read file's flights that aren't in the list yet, with their flags moved to their new positions. */
function appendFlights<T extends ItineraryExtraction>(data: T, extra: T): T {
  const known = new Set(data.segments.map(flightKey));
  const added = extra.segments.flatMap((s, i) => (s.flightNumber && known.has(flightKey(s)) ? [] : [i]));
  const offset = data.segments.length;
  const flags = extra.uncertainFields.flatMap((flag) => {
    const m = /^segments\.(\d+)\.(.+)$/.exec(flag.field);
    if (!m) return [];
    const at = added.indexOf(Number(m[1]));
    return at < 0 ? [] : [{ ...flag, field: `segments.${offset + at}.${m[2]}` }];
  });
  return { ...data, segments: [...data.segments, ...added.map((i) => extra.segments[i])], uncertainFields: [...data.uncertainFields, ...flags] };
}

/**
 * With several files in one job, the AI sometimes leaves out everything from one file. A file that prints dates and
 * times but none of whose flights came back, or that the task says was missed, is read again on its own, and what it
 * finds is added.
 */
async function addMissedDocuments<T extends ItineraryExtraction>(data: T, documents: DocumentsText, provider: ExtractionProvider, task: ExtractionTask<T>, signal: AbortSignal): Promise<T> {
  if (documents.documents.length < 2) return data;
  const missed = documents.documents.filter((text) =>
    (hasClockTime(text) && hasDate(text) && !coversDocument(data.segments, text)) || (task.missesFromDocument?.(data, text) ?? false));
  if (missed.length === 0) return data;
  const extras = await Promise.all(missed.map((text) => callProvider(provider, () => provider.extract(text, task, signal))));
  return extras.reduce<T>((merged, raw) => {
    const parsed = task.schema.safeParse(raw);
    if (!parsed.success || parsed.data.segments.length === 0) return merged;
    const withFlights = appendFlights(merged, parsed.data);
    return task.mergeDocument ? task.mergeDocument(withFlights, parsed.data) : withFlights;
  }, data);
}

/**
 * Upload(s) → validated structured data:
 * 1. Read every file (see readDocuments).
 * 2. Structure the text with the AI, in the task's strict JSON schema; re-read any file whose flights it left out.
 * 3. Validate the JSON, then run the task's checks against the documents.
 */
export async function extractDocuments<T extends ItineraryExtraction>(files: UploadedFile[], provider: ExtractionProvider, task: ExtractionTask<T>): Promise<ExtractionOutcome<T>> {
  const signal = AbortSignal.timeout(AI_TIMEOUT_MS);
  const documents = await readDocuments(files, provider, signal);

  const raw = await callProvider(provider, () => provider.extract(documents.source, task, signal));
  const parsed = task.schema.safeParse(raw);
  if (!parsed.success) {
    console.error("[extract] schema validation failed:", parsed.error.issues.length, "issues");
    throw new ExtractionError("ai_failed", "The documents were read but the result didn't look right. Please try again or enter the details manually.", 502);
  }

  const complete = provider.isDemo ? parsed.data : await addMissedDocuments(parsed.data, documents, provider, task, signal);
  const data = provider.isDemo ? complete : task.verify(complete, documents, localToday());
  if (!task.found(data)) throw new ExtractionError("no_flight_details", task.notFoundMessage, 422);

  return {
    data,
    method: provider.isDemo ? "demo" : documents.scanned ? "vision" : "pdf-text",
    demo: provider.isDemo,
  };
}
