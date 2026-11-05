import "server-only";
import { localToday } from "@/lib/dates";
import { extractionSchema, type Extraction, type ExtractionMethod } from "../schema";
import { validateUpload } from "../file-validation";
import { resolveAssumedYears } from "./assumed-years";
import { groundInSourceText } from "./grounding";
import { renderPdfPages, sliceForRead } from "./page-images";
import { extractPdfText } from "./pdf-text";
import { ExtractionError, type ExtractionProvider } from "./providers";
import { checkAgainstReads, checkItinerary, mergeRepeatedFlights } from "./verification";

const AI_TIMEOUT_MS = 100_000;
/** The second read cuts the page in different places, so its mistakes don't line up with the first's. */
const READ_SHIFTS = [0, 1] as const;

const noFlightDetails = () => new ExtractionError("no_flight_details", "We couldn't find any flight details in this document. Is it the right file?", 422);

export interface ExtractionOutcome {
  data: Extraction;
  method: ExtractionMethod;
  demo: boolean;
}

/** Models sometimes wrap a transcript in a Markdown code block. */
const stripCodeFence = (read: string) => read.trim().replace(/^```\w*\n?/, "").replace(/\n?```$/, "");

/** A read can skip a line the other caught, so the structuring step sees both. */
const combineReads = (reads: string[]) => reads.map((read, i) => `<reading_${i + 1}>\n${read}\n</reading_${i + 1}>`).join("\n\n");

/** Runs an AI call, turning anything unexpected into an error that is safe to show. */
async function callProvider<T>(provider: ExtractionProvider, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    console.error("[extract] provider failed:", provider.name, error instanceof Error ? error.name : "unknown");
    throw new ExtractionError(
      "ai_failed",
      timedOut ? "Reading the document took too long. Please try again." : "We couldn't read this document automatically. Please try again or enter the details manually.",
      502,
    );
  }
}

/** Two independent transcripts of a scan or photo. */
async function readImages(bytes: Uint8Array, isPdf: boolean, provider: ExtractionProvider, signal: AbortSignal) {
  let slices;
  try {
    const pages = isPdf ? await renderPdfPages(bytes) : [bytes];
    slices = await Promise.all(READ_SHIFTS.map((shift) => sliceForRead(pages, shift)));
  } catch (error) {
    console.error("[extract] page rendering failed:", error instanceof Error ? error.name : "unknown");
    throw new ExtractionError("invalid_file", "This file could not be opened. It may be damaged or password-protected.", 400);
  }
  return callProvider(provider, () => Promise.all(slices.map((images) => provider.transcribe(images, signal))));
}

/**
 * Upload → validated structured data.
 * 1. Verify the file (size, extension, real content type).
 * 2. PDFs: use the embedded text layer if there is one (exact, and cheapest).
 * 3. Scans, image-only PDFs and photos: render large and transcribe twice independently.
 * 4. Structure the text with the AI, validate its JSON against the schema, merge repeated flights.
 * 5. Remove anything the document doesn't print, and flag what both reads don't support.
 * 6. Resolve dates without a year, then flag impossible itineraries.
 * The file is processed in memory and never written to disk.
 */
export async function extractQuotation(fileName: string, bytes: Uint8Array, provider: ExtractionProvider): Promise<ExtractionOutcome> {
  const check = validateUpload(fileName, bytes);
  if (!check.ok) throw new ExtractionError("invalid_file", check.error, 400);
  const signal = AbortSignal.timeout(AI_TIMEOUT_MS);
  const isPdf = check.mimeType === "application/pdf";

  let text: string | null = null;
  if (isPdf) {
    text = await extractPdfText(bytes).catch(() => {
      throw new ExtractionError("invalid_file", "This PDF could not be opened. It may be damaged or password-protected.", 400);
    });
  }

  const scanned = !text && !provider.isDemo;
  let reads: string[] | null = null;
  if (scanned) {
    reads = (await readImages(bytes, isPdf, provider, signal)).map(stripCodeFence);
    if (reads.every((read) => !read)) throw noFlightDetails();
    text = combineReads(reads);
  }
  const source = text ?? "";

  const raw = await callProvider(provider, () => provider.extract(source, signal));
  const parsed = extractionSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[extract] schema validation failed:", parsed.error.issues.length, "issues");
    throw new ExtractionError("ai_failed", "The document was read but the result didn't look right. Please try again or enter the details manually.", 502);
  }

  let data = mergeRepeatedFlights(parsed.data);
  if (!provider.isDemo) data = groundInSourceText(data, source);
  if (reads) data = checkAgainstReads(data, reads);
  data = checkItinerary(resolveAssumedYears(data, localToday(), provider.isDemo ? null : source));

  if (!data.documentHasFlightDetails || data.segments.length === 0) throw noFlightDetails();

  return {
    data,
    method: provider.isDemo ? "demo" : scanned ? "vision" : "pdf-text",
    demo: provider.isDemo,
  };
}
