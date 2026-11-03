import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

/** Below this many letters/digits per page we treat the PDF as scanned and use vision instead. */
const MIN_CHARS_PER_PAGE = 80;
const MAX_TEXT_CHARS = 60_000;

/**
 * Reads the PDF's embedded text layer. Returns null when the PDF has no usable
 * text (scanned/image-only) so the caller can fall back to vision/OCR.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<string | null> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const meaningful = text.replace(/[^\p{L}\p{N}]/gu, "").length;
  if (meaningful < MIN_CHARS_PER_PAGE * Math.max(1, Math.min(totalPages, 3))) return null;
  return text.slice(0, MAX_TEXT_CHARS);
}
