import { Document, StyleSheet, Text, View } from "@react-pdf/renderer";
import { brand } from "@/config/brand";
import type { CustomerQuote } from "@/features/quotation/customer-view";
import { BandBackground, BrandHeader, KEEP_WORDS, scriptFont } from "./brand-frame";
import { DocumentPage } from "./document-page";
import { BilingualNotes, FlightItinerary, Meta, MetaGrid, Paragraph, pdfStyles } from "./itinerary";
import { layoutReporter, type PdfLayout, useMobilePdf } from "./layout";

const c = brand.colors;

const s = StyleSheet.create({
  /** On the header's white-to-blue band, with square corners like the header. */
  prices: { marginTop: 6, marginBottom: 14 },
  priceBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14 },
  /** Each further bar sits just under the one before. */
  nextPriceBox: { marginTop: 6 },
  priceText: { flexShrink: 1, paddingRight: 10 },
  priceLabel: { color: c.ink, fontSize: 6.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.4 },
  priceSub: { color: c.ink, fontSize: 7, marginTop: 2 },
  priceNames: { color: c.ink, fontSize: 7, fontFamily: "Helvetica-Bold", marginTop: 2, lineHeight: 1.4 },
  /** Under the price bars, outside them. */
  fareNotice: { color: c.muted, fontSize: 6.5, fontFamily: "Helvetica-Oblique", marginTop: 4 },
  priceValue: { color: c.ink, fontSize: 15, fontFamily: "Helvetica-Bold", letterSpacing: 0.3 },
  /** Mobile: a long amount moves under the label instead of squeezing it. */
  mobilePriceBox: { flexWrap: "wrap", paddingHorizontal: 10 },
});

/**
 * The price bars: one total, or with children or infants one bar for the adults and one for them (with their names).
 * The fare notice sits underneath, outside the bars.
 */
function PriceBox({ quote }: { quote: CustomerQuote }) {
  const mobile = useMobilePdf();
  return (
    <View style={s.prices} wrap={false}>
      {quote.prices.map((price, i) => (
        <View key={price.label} style={[s.priceBox, mobile ? s.mobilePriceBox : {}, i > 0 ? s.nextPriceBox : {}]}>
          <BandBackground id={`price-band-${i}`} />
          <View style={s.priceText}>
            <Text style={s.priceLabel}>{price.label}</Text>
            {price.detail && <Text style={s.priceSub}>{price.detail}</Text>}
            {price.names.length > 0 && <Text {...KEEP_WORDS} style={[s.priceNames, scriptFont(price.names.join(" "))]}>{price.names.join(", ")}</Text>}
          </View>
          <Text style={s.priceValue}>{price.amount}</Text>
        </View>
      ))}
      <Text style={s.fareNotice}>{brand.fareNotice}</Text>
    </View>
  );
}

interface QuotationDocumentProps {
  quote: CustomerQuote;
  logoSrc?: string | null;
  airlineLogos?: Record<string, string>;
  layout?: PdfLayout;
  /** Called with each page's content height once the document is laid out (used to trim mobile pages). */
  onLayout?: (pageHeights: number[]) => void;
  /** The portal's address, for the footer's phone links (see phoneLink). */
  siteOrigin?: string | null;
}

/** A4-width quotation that grows with its content, or phone-sized pages for the mobile layout. Takes only the customer-facing view model. */
export function QuotationDocument({ quote, logoSrc = null, airlineLogos = {}, layout = "desktop", onLayout, siteOrigin = null }: QuotationDocumentProps) {
  return (
    <Document title={`Quotation ${quote.quoteNumber}`} author={brand.legalName} creator={brand.legalName} producer={brand.legalName} onRender={layoutReporter(onLayout)}>
      <DocumentPage layout={layout} siteOrigin={siteOrigin} reference={quote.watermark ? `${quote.quoteNumber} · ${quote.watermark}` : quote.quoteNumber}>
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
