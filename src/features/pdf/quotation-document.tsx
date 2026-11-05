import { Document, G, Image, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { brand } from "@/config/brand";
import type { CustomerQuote, CustomerSegment } from "@/features/quotation/customer-view";

const c = brand.colors;

/** Drawn rather than typed, because the PDF's built-in font has no plane or arrow glyph. */
const PLANE_PATH =
  "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z";

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

  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16, marginBottom: 10 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: c.primary },
  route: { fontSize: 11, color: c.muted, marginTop: 4 },
  metaGrid: { flexDirection: "row", backgroundColor: c.surface, borderRadius: 6, padding: 10, marginBottom: 12 },
  metaCell: { flex: 1 },
  metaLabel: { fontSize: 7.5, color: c.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
  metaValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },

  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: c.primary, marginBottom: 8, marginTop: 4 },
  segment: { borderWidth: 1, borderColor: c.border, borderRadius: 6, marginBottom: 8 },
  segmentHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.surface, paddingVertical: 7, paddingHorizontal: 12, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  segmentTitle: { fontSize: 8.5, color: c.muted },
  airline: { flexDirection: "row", alignItems: "center" },
  airlineLogo: { width: 26, height: 26, objectFit: "contain", marginRight: 8 },
  airlineBadge: { width: 26, height: 26, borderRadius: 4, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", marginRight: 8 },
  airlineBadgeText: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: c.primary },
  airlineName: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: c.primary },
  segmentFlight: { fontSize: 9, color: c.muted, marginTop: 1 },
  segmentBody: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 12 },
  point: { flex: 1 },
  pointRight: { flex: 1, alignItems: "flex-end" },
  code: { fontSize: 18, fontFamily: "Helvetica-Bold", color: c.primary },
  placeName: { fontSize: 8.5, color: c.muted, marginTop: 1 },
  when: { fontSize: 9.5, marginTop: 4 },
  routeBlock: { width: 120, alignItems: "center" },
  duration: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: c.primary, marginBottom: 3 },
  routeLine: { width: 104, height: 14, justifyContent: "center" },
  arrowLine: { width: 104, height: 1.5, backgroundColor: c.accent },
  routePlane: { position: "absolute", right: 0, top: 0, width: 14, height: 14 },
  stops: { fontSize: 8, color: c.muted, marginTop: 3 },
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

/** The line between the two airports: flight time above, a plane heading to the destination, stops below. */
function Route({ segment }: { segment: CustomerSegment }) {
  return (
    <View style={s.routeBlock}>
      {segment.duration && <Text style={s.duration}>{segment.duration}</Text>}
      <View style={s.routeLine}>
        <View style={s.arrowLine} />
        <Svg viewBox="0 0 24 24" style={s.routePlane}>
          <G transform="rotate(45 12 12)">
            <Path d={PLANE_PATH} fill={c.accent} />
          </G>
        </Svg>
      </View>
      {segment.stops && <Text style={s.stops}>{segment.stops}</Text>}
    </View>
  );
}

function AirlineMark({ segment, src }: { segment: CustomerSegment; src: string | undefined }) {
  // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
  if (src) return <Image src={src} style={s.airlineLogo} />;
  return (
    <View style={s.airlineBadge}>
      <Text style={s.airlineBadgeText}>{segment.airlineCode ?? "—"}</Text>
    </View>
  );
}

function Segment({ segment, logo }: { segment: CustomerSegment; logo: string | undefined }) {
  return (
    <View style={s.segment} wrap={false}>
      <View style={s.segmentHead}>
        <View style={s.airline}>
          <AirlineMark segment={segment} src={logo} />
          <View>
            <Text style={s.airlineName}>{segment.airlineName ?? segment.flightNumber ?? "Airline to be confirmed"}</Text>
            {segment.airlineName && segment.flightNumber && <Text style={s.segmentFlight}>{segment.flightNumber}</Text>}
          </View>
        </View>
        <Text style={s.segmentTitle}>{segment.title}</Text>
      </View>
      <View style={s.segmentBody}>
        <Point point={segment.from} align="left" />
        <Route segment={segment} />
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
export function QuotationDocument({ quote, logoSrc, airlineLogos = {} }: { quote: CustomerQuote; logoSrc?: string | null; airlineLogos?: Record<string, string> }) {
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
        {quote.segments.map((segment, i) => (
          <Segment key={i} segment={segment} logo={segment.airlineCode ? airlineLogos[segment.airlineCode] : undefined} />
        ))}

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
