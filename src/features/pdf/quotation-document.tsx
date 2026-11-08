import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { brand } from "@/config/brand";
import type { CustomerQuote } from "@/features/quotation/customer-view";
import { BrandFooter, BrandHeader } from "./brand-frame";
import { BulletList, FlightCard, Meta, Paragraph, pdfStyles } from "./itinerary";

const c = brand.colors;

const s = StyleSheet.create({
  priceBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.primary, borderRadius: 6, paddingVertical: 14, paddingHorizontal: 16, marginTop: 8, marginBottom: 18 },
  priceLabel: { color: c.ink, fontSize: 10, fontFamily: "Helvetica-Bold" },
  priceSub: { color: c.ink, fontSize: 8, marginTop: 2 },
  priceValue: { color: c.ink, fontSize: 20, fontFamily: "Helvetica-Bold" },
});

interface QuotationDocumentProps {
  quote: CustomerQuote;
  logoSrc?: string | null;
  airlineLogos?: Record<string, string>;
}

/** Reusable A4 Ark Travelers quotation. Takes only the customer-facing view model. */
export function QuotationDocument({ quote, logoSrc = null, airlineLogos = {} }: QuotationDocumentProps) {
  return (
    <Document title={`Quotation ${quote.quoteNumber}`} author={brand.legalName} creator={brand.legalName} producer={brand.legalName}>
      <Page size="A4" style={pdfStyles.page}>
        <BrandHeader logoSrc={logoSrc} />
        {quote.watermark && <Text style={pdfStyles.warning}>{quote.watermark}</Text>}

        <View style={pdfStyles.titleRow}>
          <View>
            <Text style={pdfStyles.title}>Flight Quotation</Text>
            {quote.routeSummary && <Text style={pdfStyles.subtitle}>{quote.routeSummary}</Text>}
          </View>
        </View>

        <View style={pdfStyles.metaGrid}>
          <Meta label="Quotation no." value={quote.quoteNumber} />
          <Meta label="Prepared for" value={quote.customerName} />
          <Meta label="Travellers" value={quote.travellers} />
          <Meta label="Date" value={quote.issuedOn} />
        </View>

        <Text style={pdfStyles.sectionTitle}>Itinerary</Text>
        {quote.segments.map((segment, i) => (
          <FlightCard key={i} segment={segment} logo={segment.airlineCode ? airlineLogos[segment.airlineCode] : undefined} />
        ))}

        <View style={s.priceBox} wrap={false}>
          <View>
            <Text style={s.priceLabel}>Total price</Text>
            <Text style={s.priceSub}>Valid until {quote.validUntil}</Text>
          </View>
          <Text style={s.priceValue}>{quote.totalPrice}</Text>
        </View>

        <Paragraph title="Notes" text={quote.notes} />
        <Paragraph title="Fare conditions" text={quote.fareConditions} />
        <BulletList title="Terms" items={quote.terms} />

        <BrandFooter reference={quote.quoteNumber} warning={quote.watermark} />
      </Page>
    </Document>
  );
}
