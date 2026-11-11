import { createContext, useContext } from "react";

/**
 * Desktop: one A4-wide page that grows with its content.
 * Mobile: narrow, phone-shaped pages, so a phone shows every card at a readable size without zooming.
 */
export type PdfLayout = "desktop" | "mobile";

export const PDF_LAYOUTS: { value: PdfLayout; label: string }[] = [
  { value: "desktop", label: "Desktop PDF" },
  { value: "mobile", label: "Mobile PDF" },
];

/** Mobile page: a 9:16 portrait page. At this width a phone shows it at roughly 1.4× its printed size. */
export const MOBILE_PAGE = { width: 280, height: 498 } as const;
export const MOBILE_PADDING_X = 16;

export const PdfLayoutContext = createContext<PdfLayout>("desktop");

/** True inside a mobile-layout document. */
export const useMobilePdf = () => useContext(PdfLayoutContext) === "mobile";

/** File names say which layout a PDF is, so both can be kept side by side. */
export const layoutFileSuffix = (layout: PdfLayout) => (layout === "mobile" ? "-Mobile" : "");

