import { createContext, useContext, type ReactElement } from "react";

/**
 * Desktop: one A4-wide page that grows with its content.
 * Mobile: narrow, phone-shaped pages, so a phone shows every card at a readable size without zooming.
 */
export type PdfLayout = "desktop" | "mobile";

export const PDF_LAYOUTS: { value: PdfLayout; label: string }[] = [
  { value: "mobile", label: "Mobile PDF" },
  { value: "desktop", label: "Desktop PDF" },
];

/** Mobile page: a 9:16 portrait page. At this width a phone shows it at roughly 1.4× its printed size. */
export const MOBILE_PAGE = { width: 280, height: 498 } as const;
export const MOBILE_PADDING_X = 16;

export const PdfLayoutContext = createContext<PdfLayout>("desktop");

/** The portal's address (e.g. "https://portal.arktravelers.com") the PDF is made on, for links back to it. */
export const PdfSiteContext = createContext<string | null>(null);

/** True inside a mobile-layout document. */
export const useMobilePdf = () => useContext(PdfLayoutContext) === "mobile";

/** File names say which layout a PDF is, so both can be kept side by side. */
export const layoutFileSuffix = (layout: PdfLayout) => (layout === "mobile" ? "-Mobile" : "");


/* ---------- Mobile pages that end where their content ends ---------- */

/** Room kept below the last item on a mobile page. */
const MOBILE_PAGE_BOTTOM = 16;

interface LaidOutNode {
  box?: { top?: number; height?: number; marginBottom?: number };
  style?: { position?: string };
  props?: { fixed?: boolean };
}
/** What react-pdf reports after laying a document out (its internal layout, read only for page heights). */
export interface PdfLayoutData {
  children: (LaidOutNode & { box: { height: number }; children?: LaidOutNode[] })[];
}

/** Each page's height up to the end of its content, plus a little room; never taller than the page itself. */
export function pageContentHeights(layout: PdfLayoutData): number[] {
  return layout.children.map((page) => {
    const bottoms = (page.children ?? [])
      .filter((child) => !child.props?.fixed && child.style?.position !== "absolute")
      .map((child) => (child.box?.top ?? 0) + (child.box?.height ?? 0) + (child.box?.marginBottom ?? 0));
    const end = bottoms.length ? Math.max(...bottoms) + MOBILE_PAGE_BOTTOM : page.box.height;
    return Math.min(page.box.height, Math.ceil(end));
  });
}

const toLatin1 = (bytes: Uint8Array) => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return out;
};
const fromLatin1 = (text: string) => Uint8Array.from(text, (ch) => ch.charCodeAt(0));

/**
 * Cuts each page of a react-pdf document off below its content, so a phone shows no blank stretch where an item
 * moved to the next page. Every page is still its own page, so printing works as before: each page keeps its top and
 * only the empty bottom goes. Works on react-pdf's own output (plain page objects and one cross-reference table);
 * anything else is returned unchanged.
 */
export function trimPdfPages(pdf: Uint8Array, heights: readonly number[]): Uint8Array {
  const text = toLatin1(pdf);
  const kids = /\/Type \/Pages\s[\s\S]*?\/Kids \[([^\]]*)\]/.exec(text)?.[1];
  const pageIds = kids ? [...kids.matchAll(/(\d+) 0 R/g)].map((m) => m[1]) : [];
  if (pageIds.length !== heights.length || !/\nxref\n0 \d+\n/.test(text) || (text.match(/startxref/g) ?? []).length !== 1) return pdf;

  let out = text;
  pageIds.forEach((id, i) => {
    out = out.replace(new RegExp(String.raw`(\n${id} 0 obj\n<<[^>]*?/MediaBox \[)0 0 ([\d.]+) ([\d.]+)\]`), (_m, head: string, width: string, height: string) => {
      const keep = Math.min(Number(height), heights[i]);
      // PDF pages are measured from the bottom: raising the bottom edge keeps the top of the page.
      return `${head}0 ${(Number(height) - keep).toFixed(2)} ${width} ${height}]`;
    });
  });

  // The edits moved objects, so the cross-reference table is rebuilt from where each object now starts.
  const xrefAt = out.lastIndexOf("\nxref\n") + 1;
  const header = /^xref\n0 (\d+)\n/.exec(out.slice(xrefAt));
  if (!header) return pdf;
  const count = Number(header[1]);
  const offsets = new Array<number>(count).fill(-1);
  for (const m of out.slice(0, xrefAt).matchAll(/(?:^|\n)(\d+) 0 obj\n/g)) {
    const id = Number(m[1]);
    if (id < count) offsets[id] = m.index! + (m[0].startsWith("\n") ? 1 : 0);
  }
  if (offsets.slice(1).some((o) => o < 0)) return pdf;
  const entries = offsets.map((o, id) => (id === 0 ? "0000000000 65535 f \n" : `${String(o).padStart(10, "0")} 00000 n \n`)).join("");
  const tableEnd = xrefAt + header[0].length + count * 20;
  const rest = out.slice(tableEnd).replace(/startxref\n\d+/, `startxref\n${xrefAt}`);
  return fromLatin1(`${out.slice(0, xrefAt)}${header[0]}${entries}${rest}`);
}

/** A Document onRender handler that passes on each page's content height, read from react-pdf's layout. */
export const layoutReporter = (onLayout?: (pageHeights: number[]) => void) =>
  onLayout
    ? (props: object) => {
        const layout = (props as { _INTERNAL__LAYOUT__DATA_?: PdfLayoutData })._INTERNAL__LAYOUT__DATA_;
        if (layout?.children) onLayout(pageContentHeights(layout));
      }
    : undefined;

/**
 * Renders a document; a mobile one has each page trimmed to its content. `build` receives the callback to hand to the
 * document as onLayout.
 */
export async function renderTrimmed(layout: PdfLayout, build: (onLayout?: (pageHeights: number[]) => void) => ReactElement, render: (element: ReactElement) => Promise<Uint8Array>): Promise<Uint8Array> {
  if (layout !== "mobile") return render(build());
  let heights: number[] = [];
  const bytes = await render(build((h) => (heights = h)));
  return heights.length ? trimPdfPages(bytes, heights) : bytes;
}
