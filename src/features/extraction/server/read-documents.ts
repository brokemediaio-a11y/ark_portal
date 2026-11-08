import "server-only";
import { validateUpload } from "../file-validation";
import { MAX_PDF_PAGES, renderPdfPages, sliceForRead, TooManyPagesError } from "./page-images";
import { extractPdfText } from "./pdf-text";
import { ExtractionError, type ExtractionProvider } from "./providers";

export interface UploadedFile {
  name: string;
  bytes: Uint8Array;
}

export interface DocumentsText {
  /** What the structuring step reads: every document, scans as both their readings. */
  source: string;
  /** Two complete, independent readings of all documents, or null when every document had a text layer. */
  reads: [string, string] | null;
  /** True when at least one document was a scan, photo or screenshot. */
  scanned: boolean;
}

/** The second read cuts each page in different places, so its mistakes don't line up with the first's. */
const READ_SHIFTS = [0, 1] as const;
/** Scans are read a few at a time, so a batch of files doesn't trip the AI service's rate limit. */
const PARALLEL_DOCUMENTS = 3;

/** Models sometimes wrap a transcript in a Markdown code block. */
const stripCodeFence = (read: string) => read.trim().replace(/^```\w*\n?/, "").replace(/\n?```$/, "");

/** A read can skip a line the other caught, so the structuring step sees both. */
const combineReads = (reads: readonly string[]) => reads.map((read, i) => `<reading_${i + 1}>\n${read}\n</reading_${i + 1}>`).join("\n\n");

/** File names go into the prompt, so only plain characters are kept. */
const safeName = (name: string) => name.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 80);

/** Runs an AI call, turning anything unexpected into an error that is safe to show. */
export async function callProvider<T>(provider: ExtractionProvider, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    console.error("[extract] provider failed:", provider.name, error instanceof Error ? error.name : "unknown");
    throw new ExtractionError(
      "ai_failed",
      timedOut ? "Reading the documents took too long. Please try again, or with fewer files." : "We couldn't read this document automatically. Please try again or enter the details manually.",
      502,
    );
  }
}

/** One file's text: its text layer, or two independent transcripts of its pages. */
async function readOne(file: UploadedFile, provider: ExtractionProvider, signal: AbortSignal): Promise<string[]> {
  const check = validateUpload(file.name, file.bytes);
  if (!check.ok) throw new ExtractionError("invalid_file", `${file.name}: ${check.error}`, 400);
  const isPdf = check.mimeType === "application/pdf";
  const unreadable = () => new ExtractionError("invalid_file", `${file.name} could not be opened. It may be damaged or password-protected.`, 400);

  if (isPdf) {
    const text = await extractPdfText(file.bytes).catch(() => {
      throw unreadable();
    });
    if (text) return [text];
  }
  if (provider.isDemo) return [""];

  let slices;
  try {
    const pages = isPdf ? await renderPdfPages(file.bytes) : [file.bytes];
    slices = await Promise.all(READ_SHIFTS.map((shift) => sliceForRead(pages, shift)));
  } catch (error) {
    if (error instanceof TooManyPagesError)
      throw new ExtractionError("invalid_file", `${file.name} has ${error.pages} pages. Scanned PDFs can have at most ${MAX_PDF_PAGES}; please split it into smaller files.`, 400);
    console.error("[extract] page rendering failed:", error instanceof Error ? error.name : "unknown");
    throw unreadable();
  }
  const reads = await callProvider(provider, () => Promise.all(slices.map((images) => provider.transcribe(images, signal))));
  return reads.map(stripCodeFence);
}

/**
 * Turns uploaded files into text for the AI to structure.
 * - PDFs with a text layer are read exactly, locally and for free.
 * - Scans, image-only PDFs and photos are rendered large and transcribed twice.
 * - Several files are labelled as separate documents of one job.
 * Files are processed in memory and never written to disk.
 */
export async function readDocuments(files: UploadedFile[], provider: ExtractionProvider, signal: AbortSignal): Promise<DocumentsText> {
  const texts: string[][] = [];
  for (let i = 0; i < files.length; i += PARALLEL_DOCUMENTS)
    texts.push(...(await Promise.all(files.slice(i, i + PARALLEL_DOCUMENTS).map((file) => readOne(file, provider, signal)))));

  if (!provider.isDemo && texts.every((reads) => reads.every((read) => !read.trim())))
    throw new ExtractionError("no_flight_details", "We couldn't find any text in these documents. Are they the right files?", 422);

  const many = files.length > 1;
  const wrap = (body: string, i: number) => (many ? `<document_${i + 1} name="${safeName(files[i].name)}">\n${body}\n</document_${i + 1}>` : body);
  const source = texts.map((reads, i) => wrap(reads.length > 1 ? combineReads(reads) : reads[0], i)).join("\n\n");
  const scanned = texts.some((reads) => reads.length > 1);
  const reading = (n: 0 | 1) => texts.map((reads, i) => wrap(reads[Math.min(n, reads.length - 1)], i)).join("\n\n");

  return { source, reads: scanned ? [reading(0), reading(1)] : null, scanned };
}
