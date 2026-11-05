import "server-only";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { getDocumentProxy, renderPageAsImage } from "unpdf";
import type { DocumentImage } from "./providers";

/** Renders PDF pages at about 180 dpi, so small print stays sharp. */
const PDF_RENDER_SCALE = 2.5;
const MAX_PDF_PAGES = 4;
const MAX_SLICES_PER_READ = 12;
/** Slice height relative to width. Wide slices keep the most detail after the AI service resizes them. */
const SLICE_ASPECT = 0.62;
const SLICE_OVERLAP = 0.15;
/** Rows lighter than this on every sampled pixel count as blank page. */
const BLANK_THRESHOLD = 245;

export async function renderPdfPages(bytes: Uint8Array): Promise<Uint8Array[]> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const count = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const pages: Uint8Array[] = [];
  for (let page = 1; page <= count; page++) {
    const png = await renderPageAsImage(new Uint8Array(bytes), page, {
      canvasImport: () => import("@napi-rs/canvas"),
      scale: PDF_RENDER_SCALE,
    });
    pages.push(new Uint8Array(png));
  }
  return pages;
}

/** Top and bottom of the page's content, so blank margins aren't sent to the AI. */
function contentRows(data: Uint8ClampedArray, width: number, height: number) {
  const hasInk = (y: number) => {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      if (data[i] < BLANK_THRESHOLD || data[i + 1] < BLANK_THRESHOLD || data[i + 2] < BLANK_THRESHOLD) return true;
    }
    return false;
  };
  let top = 0;
  let bottom = height - 1;
  while (top < bottom && !hasInk(top)) top++;
  while (bottom > top && !hasInk(bottom)) bottom--;
  return { top, bottom: bottom + 1 };
}

/** Row ranges of overlapping slices covering `top`–`bottom`. `shift` (0–1) moves the cut lines. */
export function sliceRanges(top: number, bottom: number, width: number, shift: number): [number, number][] {
  const sliceHeight = Math.round(width * SLICE_ASPECT);
  if (bottom - top <= sliceHeight * 1.2) return [[top, bottom]];

  const overlap = Math.round(sliceHeight * SLICE_OVERLAP);
  const ranges: [number, number][] = [];
  let start = top;
  let end = top + Math.round(sliceHeight * (1 - shift * 0.5));
  while (end < bottom) {
    ranges.push([start, end]);
    start = end - overlap;
    end = start + sliceHeight;
  }
  ranges.push([start, bottom]);
  return ranges;
}

/**
 * Cuts a page into overlapping horizontal slices. Vision APIs shrink a whole page
 * until small print is unreadable, which makes models invent values; a slice
 * keeps the text large. Different `shift`s let a second read see the page cut
 * differently, so its mistakes don't line up with the first's.
 */
async function sliceImage(png: Uint8Array, shift: number): Promise<DocumentImage[]> {
  const image = await loadImage(Buffer.from(png));
  const { width, height } = image;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const { top, bottom } = contentRows(ctx.getImageData(0, 0, width, height).data, width, height);

  return sliceRanges(top, bottom, width, shift).map(([from, to]) => {
    const slice = createCanvas(width, to - from);
    slice.getContext("2d").drawImage(canvas, 0, from, width, to - from, 0, 0, width, to - from);
    return { mimeType: "image/png", base64: slice.toBuffer("image/png").toString("base64") };
  });
}

/** All pages as slices for one read, in reading order. */
export async function sliceForRead(pages: Uint8Array[], shift: number): Promise<DocumentImage[]> {
  const slices = await Promise.all(pages.map((page) => sliceImage(page, shift)));
  return slices.flat().slice(0, MAX_SLICES_PER_READ);
}
