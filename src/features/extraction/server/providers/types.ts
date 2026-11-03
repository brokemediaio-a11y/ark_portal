import "server-only";
import type { AcceptedMimeType } from "@/config/upload";
import type { ExtractErrorCode } from "../../schema";

export type ExtractionInput =
  | { kind: "text"; text: string }
  | { kind: "file"; mimeType: AcceptedMimeType; base64: string; fileName: string };

/**
 * Any AI backend that turns a document into raw JSON. The result is untrusted
 * and is always schema-validated by the extraction service.
 */
export interface ExtractionProvider {
  readonly name: string;
  readonly isDemo: boolean;
  extract(input: ExtractionInput, signal: AbortSignal): Promise<unknown>;
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
