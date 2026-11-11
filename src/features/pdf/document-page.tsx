import { Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { brand } from "@/config/brand";
import { BrandClosing, PAGE_PADDING_X } from "./brand-frame";
import { pdfStyles } from "./itinerary";
import { MOBILE_PADDING_X, MOBILE_PAGE, PdfLayoutContext, type PdfLayout } from "./layout";

export const PDF_PAGE_WIDTH = 595.28;

const styles = StyleSheet.create({
  content: { paddingHorizontal: PAGE_PADDING_X, paddingBottom: 20 },
  mobilePage: { paddingTop: 18, paddingBottom: 26, paddingHorizontal: MOBILE_PADDING_X },
  pageNumber: { position: "absolute", bottom: 10, left: 0, right: 0, textAlign: "center", fontSize: 6.5, color: brand.colors.muted, letterSpacing: 0.6 },
});

/**
 * Desktop: A4 width with content-driven height, so the closing footer never becomes a separate page.
 * Mobile: phone-shaped pages that flow onto as many pages as needed; cards never split across pages.
 */
export function DocumentPage({ children, reference, layout = "desktop" }: { children: ReactNode; reference: string; layout?: PdfLayout }) {
  if (layout === "mobile") {
    return (
      <PdfLayoutContext.Provider value="mobile">
        <Page size={[MOBILE_PAGE.width, MOBILE_PAGE.height]} style={[pdfStyles.page, styles.mobilePage]}>
          {/* Sections sit straight on the page, so each one can move to the next page whole. */}
          {children}
          <BrandClosing reference={reference} />
          <Text style={styles.pageNumber} fixed render={({ pageNumber, totalPages }) => (totalPages > 1 ? `${pageNumber} / ${totalPages}` : "")} />
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
