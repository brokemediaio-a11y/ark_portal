import "server-only";
import { getDocumentProxy } from "unpdf";
import { textInReadingOrder } from "./pdf-text-layout";

/** Below this many letters/digits per page we treat the PDF as scanned and use vision instead. */
const MIN_CHARS_PER_PAGE = 80;
const MAX_TEXT_CHARS = 60_000;

/**
 * Reads the PDF's embedded text layer. Returns null when the PDF has no usable
 * text (scanned/image-only) so the caller can fall back to vision/OCR.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<string | null> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const totalPages = pdf.numPages;
  const pages: string[] = [];
  let length = 0;
  for (let index = 1; index <= totalPages && length < MAX_TEXT_CHARS; index++) {
    const page = await pdf.getPage(index);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const text = textInReadingOrder(content.items.filter(item => "str" in item).map(item => {
      const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
      return { text: item.str, x, y, width: item.width };
    }));
    pages.push(`<page_${index}>\n${text}\n</page_${index}>`);
    length += text.length;
  }
  const text = pages.join("\n\n");
  const meaningful = pages.map(page => page.replace(/<\/?page_\d+>/g, "")).join("").replace(/[^\p{L}\p{N}]/gu, "").length;
  if (meaningful < MIN_CHARS_PER_PAGE * Math.max(1, Math.min(totalPages, 3))) return null;
  return text.slice(0, MAX_TEXT_CHARS);
}
