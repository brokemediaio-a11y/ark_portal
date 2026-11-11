import { Document, StyleSheet, Text, View } from "@react-pdf/renderer";
import { brand } from "@/config/brand";
import type { CustomerQuote } from "@/features/quotation/customer-view";
import { BandBackground, BrandHeader } from "./brand-frame";
import { DocumentPage } from "./document-page";
import { BilingualNotes, FlightItinerary, Meta, MetaGrid, Paragraph, pdfStyles } from "./itinerary";
import { type PdfLayout, useMobilePdf } from "./layout";

const c = brand.colors;

const s = StyleSheet.create({
  /** On the header's white-to-blue band, with square corners like the header. */
  priceBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, marginTop: 6, marginBottom: 14 },
  priceLabel: { color: c.ink, fontSize: 6.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.4 },
  priceSub: { color: c.ink, fontSize: 7, marginTop: 2 },
  priceValue: { color: c.ink, fontSize: 15, fontFamily: "Helvetica-Bold", letterSpacing: 0.3 },
  /** Mobile: a long amount moves under the label instead of squeezing it. */
  mobilePriceBox: { flexWrap: "wrap", paddingHorizontal: 10 },
});

function PriceBox({ quote }: { quote: CustomerQuote }) {
  return (
    <View style={useMobilePdf() ? [s.priceBox, s.mobilePriceBox] : s.priceBox} wrap={false}>
      <BandBackground id="price-band" />
      <View>
        <Text style={s.priceLabel}>Total price</Text>
        <Text style={s.priceSub}>Valid until {quote.validUntil}</Text>
      </View>
      <Text style={s.priceValue}>{quote.totalPrice}</Text>
    </View>
  );
}

interface QuotationDocumentProps {
  quote: CustomerQuote;
  logoSrc?: string | null;
  airlineLogos?: Record<string, string>;
  layout?: PdfLayout;
}

/** A4-width quotation that grows with its content, or phone-sized pages for the mobile layout. Takes only the customer-facing view model. */
export function QuotationDocument({ quote, logoSrc = null, airlineLogos = {}, layout = "desktop" }: QuotationDocumentProps) {
  return (
    <Document title={`Quotation ${quote.quoteNumber}`} author={brand.legalName} creator={brand.legalName} producer={brand.legalName}>
      <DocumentPage layout={layout} reference={quote.watermark ? `${quote.quoteNumber} · ${quote.watermark}` : quote.quoteNumber}>
        <BrandHeader logoSrc={logoSrc} />
        {quote.watermark && <Text style={pdfStyles.warning}>{quote.watermark}</Text>}

        <View style={pdfStyles.titleRow}>
          <View>
            <Text style={pdfStyles.title}>Flight Quotation</Text>
            {quote.routeSummary && <Text style={pdfStyles.subtitle}>{quote.routeSummary}</Text>}
          </View>
        </View>

        <MetaGrid>
          <Meta label="Quotation no." value={quote.quoteNumber} />
          <Meta label="Prepared for" value={quote.customerName} />
          <Meta label="Travellers" value={quote.travellers} />
          <Meta label="Date" value={quote.issuedOn} />
        </MetaGrid>

        <FlightItinerary title="Itinerary" segments={quote.segments} airlineLogos={airlineLogos} />

        <PriceBox quote={quote} />

        <Paragraph title="Notes" text={quote.notes} />
        <Paragraph title="Fare conditions" text={quote.fareConditions} />
        <BilingualNotes title="Terms" dariTitle={brand.termsDariTitle} items={quote.terms} dariItems={quote.termsDari} />

      </DocumentPage>
    </Document>
  );
}
