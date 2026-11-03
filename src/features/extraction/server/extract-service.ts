import "server-only";
import { localToday } from "@/lib/dates";
import { extractionSchema, type Extraction, type ExtractionMethod } from "../schema";
import { validateUpload } from "../file-validation";
import { resolveAssumedYears } from "./assumed-years";
import { groundInSourceText } from "./grounding";
import { extractPdfText } from "./pdf-text";
import { ExtractionError, type ExtractionInput, type ExtractionProvider } from "./providers";

const AI_TIMEOUT_MS = 90_000;

export interface ExtractionOutcome {
  data: Extraction;
  method: ExtractionMethod;
  demo: boolean;
}

/**
 * Upload → validated structured data.
 * 1. Verify the file (size, extension, real content type).
 * 2. PDFs: use the embedded text layer if there is one (cheaper, more exact).
 * 3. Scanned PDFs and images: send the file to a vision-capable model (acts as OCR).
 * 4. Validate the model's JSON against the schema before returning anything.
 * 5. For text PDFs, drop names/labels the model returned that aren't in the document.
 * 6. Resolve dates printed without a year (flagged by the model) to the next occurrence.
 * The file is processed in memory and never written to disk.
 */
export async function extractQuotation(
  fileName: string,
  bytes: Uint8Array,
  provider: ExtractionProvider,
): Promise<ExtractionOutcome> {
  const check = validateUpload(fileName, bytes);
  if (!check.ok) throw new ExtractionError("invalid_file", check.error, 400);

  let input: ExtractionInput | null = null;
  if (check.mimeType === "application/pdf") {
    const text = await extractPdfText(bytes).catch(() => {
      throw new ExtractionError("invalid_file", "This PDF could not be opened. It may be damaged or password-protected.", 400);
    });
    if (text) input = { kind: "text", text };
  }
  input ??= {
    kind: "file",
    mimeType: check.mimeType,
    base64: Buffer.from(bytes).toString("base64"),
    fileName,
  };

  const raw = await provider.extract(input, AbortSignal.timeout(AI_TIMEOUT_MS)).catch((error) => {
    if (error instanceof ExtractionError) throw error;
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    console.error("[extract] provider failed:", provider.name, error instanceof Error ? error.name : "unknown");
    throw new ExtractionError(
      "ai_failed",
      timedOut ? "Reading the document took too long. Please try again." : "We couldn't read this document automatically. Please try again or enter the details manually.",
      502,
    );
  });

  const parsed = extractionSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[extract] schema validation failed:", parsed.error.issues.length, "issues");
    throw new ExtractionError("ai_failed", "The document was read but the result didn't look right. Please try again or enter the details manually.", 502);
  }

  const grounded = input.kind === "text" ? groundInSourceText(parsed.data, input.text) : parsed.data;
  const data = resolveAssumedYears(grounded, localToday());
  if (!data.documentHasFlightDetails || data.segments.length === 0)
    throw new ExtractionError("no_flight_details", "We couldn't find any flight details in this document. Is it the right file?", 422);

  return {
    data,
    method: provider.isDemo ? "demo" : input.kind === "text" ? "pdf-text" : "vision",
    demo: provider.isDemo,
  };
}
