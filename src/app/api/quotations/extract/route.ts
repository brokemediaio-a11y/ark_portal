import { extractQuotation } from "@/features/extraction/server/extract-service";
import { ExtractionError, getExtractionProvider } from "@/features/extraction/server/providers";
import type { ExtractResponse } from "@/features/extraction/schema";
import { UPLOAD_MAX_BYTES } from "@/config/upload";

export const maxDuration = 120;

const fail = (error: ExtractionError) =>
  Response.json({ ok: false, error: error.message, code: error.code } satisfies ExtractResponse, {
    status: error.status,
  });

export async function POST(request: Request) {
  try {
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > UPLOAD_MAX_BYTES + 64 * 1024)
      throw new ExtractionError("invalid_file", "This file is too large.", 413);

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File))
      throw new ExtractionError("invalid_file", "No file was received. Please choose a file.", 400);

    const provider = getExtractionProvider();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await extractQuotation(file.name, bytes, provider);

    return Response.json({ ok: true, ...result } satisfies ExtractResponse);
  } catch (error) {
    if (error instanceof ExtractionError) return fail(error);
    console.error("[extract] unexpected error:", error instanceof Error ? error.message : "unknown");
    return fail(new ExtractionError("ai_failed", "Something went wrong. Please try again.", 500));
  }
}
