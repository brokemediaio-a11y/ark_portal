import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { brand } from "@/config/brand";
import type { CustomerQuote } from "@/features/quotation/customer-view";
import { BrandClosing, BrandHeader } from "./brand-frame";
import { BulletList, FlightCard, Meta, Paragraph, pdfStyles } from "./itinerary";

const c = brand.colors;

const s = StyleSheet.create({
  priceBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.primary, borderRadius: 5, paddingVertical: 10, paddingHorizontal: 14, marginTop: 6, marginBottom: 14 },
  priceLabel: { color: c.ink, fontSize: 6.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.4 },
  priceSub: { color: c.ink, fontSize: 7, marginTop: 2 },
  priceValue: { color: c.ink, fontSize: 15, fontFamily: "Helvetica-Bold", letterSpacing: 0.3 },
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

        <BrandClosing logoSrc={logoSrc} reference={quote.watermark ? `${quote.quoteNumber} · ${quote.watermark}` : quote.quoteNumber} />
      </Page>
    </Document>
  );
}
