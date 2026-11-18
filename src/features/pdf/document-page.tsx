import { Page, StyleSheet, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { BrandClosing, PAGE_PADDING_X } from "./brand-frame";
import { pdfStyles } from "./itinerary";
import { MOBILE_PADDING_X, MOBILE_PAGE, PdfLayoutContext, PdfSiteContext, type PdfLayout } from "./layout";

export const PDF_PAGE_WIDTH = 595.28;

const styles = StyleSheet.create({
  content: { paddingHorizontal: PAGE_PADDING_X, paddingBottom: 20 },
  /** No page number at the foot: each page is trimmed to its content once laid out (see trimPdfPages). */
  mobilePage: { paddingTop: 18, paddingBottom: 12, paddingHorizontal: MOBILE_PADDING_X },
});

/**
 * Desktop: A4 width with content-driven height, so the closing footer never becomes a separate page.
 * Mobile: phone-width pages that flow onto as many pages as needed; cards never split across pages, and each page
 * is trimmed to its content afterwards, so nothing is left blank where an item moved on.
 */
export function DocumentPage({ children, reference, layout = "desktop", siteOrigin = null }: { children: ReactNode; reference: string; layout?: PdfLayout; siteOrigin?: string | null }) {
  return (
    <PdfSiteContext.Provider value={siteOrigin}>
      <LayoutPage reference={reference} layout={layout}>{children}</LayoutPage>
    </PdfSiteContext.Provider>
  );
}

function LayoutPage({ children, reference, layout }: { children: ReactNode; reference: string; layout: PdfLayout }) {
  if (layout === "mobile") {
    return (
      <PdfLayoutContext.Provider value="mobile">
        <Page size={[MOBILE_PAGE.width, MOBILE_PAGE.height]} style={[pdfStyles.page, styles.mobilePage]}>
          {/* Sections sit straight on the page, so each one can move to the next page whole. */}
          {children}
          <BrandClosing reference={reference} />
        </Page>
      </PdfLayoutContext.Provider>
    );
  }
  return (
    <Page size={{ width: PDF_PAGE_WIDTH }} wrap={false} style={pdfStyles.page}>
      <View style={styles.content}>{children}</View>
      <BrandClosing reference={reference} />
    </Page>
  );
}
