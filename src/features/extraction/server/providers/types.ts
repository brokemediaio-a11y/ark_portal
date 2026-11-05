import "server-only";
import type { ExtractErrorCode } from "../../schema";

export interface DocumentImage {
  mimeType: string;
  base64: string;
}

/**
 * Any AI backend that can read a document. `extract` returns raw JSON, which is
 * untrusted and always schema-validated by the extraction service.
 */
export interface ExtractionProvider {
  readonly name: string;
  readonly isDemo: boolean;
  /** Copies the text from page images, without interpreting it. */
  transcribe(images: DocumentImage[], signal: AbortSignal): Promise<string>;
  /** Turns a document's text into structured data. */
  extract(documentText: string, signal: AbortSignal): Promise<unknown>;
}

/** An error whose message is safe to show to staff (no secrets, no raw provider output). */
export class ExtractionError extends Error {
  constructor(
    public readonly code: ExtractErrorCode,
    message: string,
    public readonly status = 422,
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}
