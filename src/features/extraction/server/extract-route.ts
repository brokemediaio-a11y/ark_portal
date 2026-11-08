import "server-only";
import { UPLOAD_MAX_FILES, UPLOAD_MAX_TOTAL_BYTES } from "@/config/upload";
import type { ExtractResponse } from "../schema";
import { extractDocuments, type ExtractionTask } from "./extract-service";
import { ExtractionError, getExtractionProvider } from "./providers";
import type { UploadedFile } from "./read-documents";

const fail = (error: ExtractionError) =>
  Response.json({ ok: false, error: error.message, code: error.code } satisfies ExtractResponse, { status: error.status });

/** Shared handler for the extraction endpoints: one or more files in the "file" field of a form. */
export async function handleExtractRequest<T>(request: Request, task: ExtractionTask<T>): Promise<Response> {
  try {
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > UPLOAD_MAX_TOTAL_BYTES + 256 * 1024)
      throw new ExtractionError("invalid_file", "These files are too large together. Please upload fewer at a time.", 413);

    const form = await request.formData().catch(() => null);
    const entries = form?.getAll("file").filter((f): f is File => f instanceof File) ?? [];
    if (entries.length === 0) throw new ExtractionError("invalid_file", "No file was received. Please choose a file.", 400);
    if (entries.length > UPLOAD_MAX_FILES)
      throw new ExtractionError("invalid_file", `Please upload at most ${UPLOAD_MAX_FILES} files at a time.`, 400);
    if (entries.reduce((sum, f) => sum + f.size, 0) > UPLOAD_MAX_TOTAL_BYTES)
      throw new ExtractionError("invalid_file", "These files are too large together. Please upload fewer at a time.", 413);

    const provider = getExtractionProvider();
    const files: UploadedFile[] = await Promise.all(entries.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })));
    const result = await extractDocuments(files, provider, task);
    return Response.json({ ok: true, ...result } satisfies ExtractResponse<T>);
  } catch (error) {
    if (error instanceof ExtractionError) return fail(error);
    console.error("[extract] unexpected error:", error instanceof Error ? error.message : "unknown");
    return fail(new ExtractionError("ai_failed", "Something went wrong. Please try again.", 500));
  }
}
