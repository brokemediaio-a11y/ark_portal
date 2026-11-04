import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { brand } from "@/config/brand";
import type { CustomerQuote, CustomerSegment } from "@/features/quotation/customer-view";

const c = brand.colors;

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 64, paddingHorizontal: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1A2633" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 16, borderBottomWidth: 3, borderBottomColor: c.primary },
  logoMark: { flexDirection: "row", alignItems: "center" },
  logoBox: { width: 38, height: 38, borderRadius: 8, backgroundColor: c.primary, justifyContent: "center", alignItems: "center", marginRight: 10 },
  logoLetter: { color: "#FFFFFF", fontSize: 18, fontFamily: "Helvetica-Bold" },
  logoImage: { height: 58, objectFit: "contain" },
  brandName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: c.primary },
  tagline: { fontSize: 8.5, color: c.muted, marginTop: 2 },
  contact: { alignItems: "flex-end", fontSize: 8.5, color: c.muted, lineHeight: 1.5 },

  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 22, marginBottom: 14 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: c.primary },
  route: { fontSize: 11, color: c.muted, marginTop: 4 },
  metaGrid: { flexDirection: "row", backgroundColor: c.surface, borderRadius: 6, padding: 12, marginBottom: 18 },
  metaCell: { flex: 1 },
  metaLabel: { fontSize: 7.5, color: c.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
  metaValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },

  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: c.primary, marginBottom: 8, marginTop: 4 },
  segment: { borderWidth: 1, borderColor: c.border, borderRadius: 6, marginBottom: 10 },
  segmentHead: { flexDirection: "row", justifyContent: "space-between", backgroundColor: c.surface, paddingVertical: 6, paddingHorizontal: 12, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  segmentTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  segmentFlight: { fontSize: 9.5, color: c.muted },
  segmentBody: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12 },
  point: { flex: 1 },
  pointRight: { flex: 1, alignItems: "flex-end" },
  code: { fontSize: 18, fontFamily: "Helvetica-Bold", color: c.primary },
  placeName: { fontSize: 8.5, color: c.muted, marginTop: 1 },
  when: { fontSize: 9.5, marginTop: 4 },
  arrow: { width: 70, alignItems: "center" },
  arrowLine: { width: 56, height: 1.5, backgroundColor: c.accent },
  details: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, paddingBottom: 9 },
  detail: { fontSize: 8.5, color: c.muted, marginRight: 14 },

  priceBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.primary, borderRadius: 6, paddingVertical: 14, paddingHorizontal: 16, marginTop: 8, marginBottom: 18 },
  priceLabel: { color: "#FFFFFF", fontSize: 10 },
  priceSub: { color: "#C9D8E3", fontSize: 8, marginTop: 2 },
  priceValue: { color: "#FFFFFF", fontSize: 20, fontFamily: "Helvetica-Bold" },

  paragraph: { fontSize: 9.5, lineHeight: 1.5, marginBottom: 12 },
  term: { flexDirection: "row", fontSize: 8.5, color: c.muted, lineHeight: 1.5, marginBottom: 2 },
  bullet: { width: 10 },

  demo: { backgroundColor: "#D64545", color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 10, textAlign: "center", paddingVertical: 6, borderRadius: 4, marginTop: 12 },
  footer: { position: "absolute", bottom: 28, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8, fontSize: 7.5, color: c.muted },
});

function Point({ point, align }: { point: CustomerSegment["from"]; align: "left" | "right" }) {
  return (
    <View style={align === "left" ? s.point : s.pointRight}>
      <Text style={s.code}>{point.code ?? "—"}</Text>
      {point.name && <Text style={s.placeName}>{point.name}</Text>}
      <Text style={s.when}>{[point.date, point.time].filter(Boolean).join("  ·  ") || "—"}</Text>
    </View>
  );
}

function Segment({ segment }: { segment: CustomerSegment }) {
  return (
    <View style={s.segment} wrap={false}>
      <View style={s.segmentHead}>
        <Text style={s.segmentTitle}>{segment.title}</Text>
        {segment.flight && <Text style={s.segmentFlight}>{segment.flight}</Text>}
      </View>
      <View style={s.segmentBody}>
        <Point point={segment.from} align="left" />
        <View style={s.arrow}><View style={s.arrowLine} /></View>
        <Point point={segment.to} align="right" />
      </View>
      {segment.details.length > 0 && (
        <View style={s.details}>
          {segment.details.map((d) => <Text key={d} style={s.detail}>{d}</Text>)}
        </View>
      )}
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={s.metaCell}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaValue}>{value ?? "—"}</Text>
    </View>
  );
}

/** Reusable A4 Ark Travelers quotation. Takes only the customer-facing view model. */
export function QuotationDocument({ quote, logoSrc }: { quote: CustomerQuote; logoSrc?: string | null }) {
  return (
    <Document title={`Quotation ${quote.quoteNumber}`} author={brand.name} creator={brand.name} producer={brand.name}>
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          {logoSrc ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
            <Image src={logoSrc} style={s.logoImage} />
          ) : (
            <View style={s.logoMark}>
              <View style={s.logoBox}><Text style={s.logoLetter}>{brand.name.charAt(0)}</Text></View>
              <View>
                <Text style={s.brandName}>{brand.name}</Text>
                <Text style={s.tagline}>{brand.tagline}</Text>
              </View>
            </View>
          )}
          <View style={s.contact}>
            <Text>{brand.contact.phone}</Text>
            <Text>{brand.contact.email}</Text>
            <Text>{brand.contact.website}</Text>
          </View>
        </View>

        {quote.watermark && <Text style={s.demo}>{quote.watermark}</Text>}

        <View style={s.titleRow}>
          <View>
            <Text style={s.title}>Flight Quotation</Text>
            {quote.routeSummary && <Text style={s.route}>{quote.routeSummary}</Text>}
          </View>
        </View>

        <View style={s.metaGrid}>
          <Meta label="Quotation no." value={quote.quoteNumber} />
          <Meta label="Prepared for" value={quote.customerName} />
          <Meta label="Travellers" value={quote.travellers} />
          <Meta label="Date" value={quote.issuedOn} />
        </View>

        <Text style={s.sectionTitle}>Itinerary</Text>
        {quote.segments.map((segment, i) => <Segment key={i} segment={segment} />)}

        <View style={s.priceBox} wrap={false}>
          <View>
            <Text style={s.priceLabel}>Total price</Text>
            <Text style={s.priceSub}>Valid until {quote.validUntil}</Text>
          </View>
          <Text style={s.priceValue}>{quote.totalPrice}</Text>
        </View>

        {quote.notes && (
          <View wrap={false}>
            <Text style={s.sectionTitle}>Notes</Text>
            <Text style={s.paragraph}>{quote.notes}</Text>
          </View>
        )}
        {quote.fareConditions && (
          <View wrap={false}>
            <Text style={s.sectionTitle}>Fare conditions</Text>
            <Text style={s.paragraph}>{quote.fareConditions}</Text>
          </View>
        )}
        {quote.terms.length > 0 && (
          <View wrap={false}>
            <Text style={s.sectionTitle}>Terms</Text>
            {quote.terms.map((t) => (
              <View key={t} style={s.term}>
                <Text style={s.bullet}>•</Text>
                <Text style={{ flex: 1 }}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.footer} fixed>
          <Text>{quote.watermark ? `${quote.watermark} · ` : ""}{brand.name} · {brand.contact.address}</Text>
          <Text render={({ pageNumber, totalPages }) => `${quote.quoteNumber} · Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
