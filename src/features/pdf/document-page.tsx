import { Page, StyleSheet, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { BrandClosing, PAGE_PADDING_X } from "./brand-frame";
import { pdfStyles } from "./itinerary";

export const PDF_PAGE_WIDTH = 595.28;

const styles = StyleSheet.create({
  content: { paddingHorizontal: PAGE_PADDING_X, paddingBottom: 20 },
});

/** A4 width with content-driven height: the closing footer never becomes a separate page. */
export function DocumentPage({ children, logoSrc, reference }: { children: ReactNode; logoSrc: string | null; reference: string }) {
  return (
    <Page size={{ width: PDF_PAGE_WIDTH }} wrap={false} style={pdfStyles.page}>
      <View style={styles.content}>{children}</View>
      <BrandClosing logoSrc={logoSrc} reference={reference} />
    </Page>
  );
}
