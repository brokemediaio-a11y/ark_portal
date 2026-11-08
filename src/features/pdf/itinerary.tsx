import { G, Image, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { brand } from "@/config/brand";
import type { CustomerSegment } from "@/features/quotation/customer-view";
import { PAGE_PADDING_X, PLANE_PATH, scriptFont } from "./brand-frame";

/** Flight cards and page styles shared by the quotation and the e-ticket. */

const c = brand.colors;

export const pdfStyles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 60, paddingHorizontal: PAGE_PADDING_X, fontSize: 10, fontFamily: "Helvetica", color: c.ink },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16, marginBottom: 10 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: c.ink },
  subtitle: { fontSize: 11, color: c.muted, marginTop: 4 },
  metaGrid: { flexDirection: "row", backgroundColor: c.surface, borderLeftWidth: 4, borderLeftColor: c.primary, borderRadius: 4, padding: 10, marginBottom: 12 },
  metaCell: { flex: 1, paddingRight: 6 },
  metaLabel: { fontSize: 7.5, color: c.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
  metaValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: c.ink, marginBottom: 8, marginTop: 4, paddingBottom: 3, borderBottomWidth: 1.5, borderBottomColor: c.primary },
  paragraph: { fontSize: 9.5, lineHeight: 1.5, marginBottom: 12 },
  term: { flexDirection: "row", fontSize: 8.5, color: c.muted, lineHeight: 1.5, marginBottom: 2 },
  bullet: { width: 10 },
  warning: { backgroundColor: "#D64545", color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 10, textAlign: "center", paddingVertical: 6, borderRadius: 4, marginTop: 12 },
});

const s = StyleSheet.create({
  segment: { borderWidth: 1, borderColor: c.border, borderRadius: 6, marginBottom: 8 },
  segmentHead: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.surface,
    borderBottomWidth: 2, borderBottomColor: c.primary, paddingVertical: 7, paddingHorizontal: 12, borderTopLeftRadius: 6, borderTopRightRadius: 6,
  },
  segmentTitle: { fontSize: 8.5, color: c.muted },
  airline: { flexDirection: "row", alignItems: "center" },
  airlineLogo: { width: 26, height: 26, objectFit: "contain", marginRight: 8 },
  airlineBadge: { width: 26, height: 26, borderRadius: 4, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", marginRight: 8 },
  airlineBadgeText: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: c.ink },
  airlineName: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: c.ink },
  segmentFlight: { fontSize: 9, color: c.muted, marginTop: 1 },
  segmentBody: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 12 },
  point: { flex: 1 },
  pointRight: { flex: 1, alignItems: "flex-end" },
  code: { fontSize: 18, fontFamily: "Helvetica-Bold", color: c.ink },
  /** A place name standing in for a missing airport code: smaller, so long names don't wrap. */
  nameAsCode: { fontSize: 12, fontFamily: "Helvetica-Bold", color: c.ink, maxWidth: 180 },
  placeName: { fontSize: 8.5, color: c.muted, marginTop: 1 },
  when: { fontSize: 9.5, marginTop: 4 },
  routeBlock: { width: 120, alignItems: "center" },
  duration: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: c.ink, marginBottom: 3 },
  routeLine: { width: 104, height: 14, justifyContent: "center" },
  arrowLine: { width: 104, height: 1.5, backgroundColor: c.accent },
  routePlane: { position: "absolute", right: 0, top: 0, width: 14, height: 14 },
  stops: { fontSize: 8, color: c.muted, marginTop: 3 },
  details: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, paddingBottom: 9 },
  detail: { fontSize: 8.5, color: c.muted, marginRight: 14 },
});

function Point({ point, align }: { point: CustomerSegment["from"]; align: "left" | "right" }) {
  return (
    <View style={align === "left" ? s.point : s.pointRight}>
      {/* Some tickets print only the airport's name: it then takes the code's place. */}
      <Text style={[point.code ? s.code : s.nameAsCode, scriptFont(point.code ?? point.name)]}>{point.code ?? point.name ?? "—"}</Text>
      {point.code && point.name && <Text style={[s.placeName, scriptFont(point.name)]}>{point.name}</Text>}
      {point.terminal && <Text style={s.placeName}>Terminal {point.terminal}</Text>}
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

export function FlightCard({ segment, logo }: { segment: CustomerSegment; logo: string | undefined }) {
  return (
    <View style={s.segment} wrap={false}>
      <View style={s.segmentHead}>
        <View style={s.airline}>
          <AirlineMark segment={segment} src={logo} />
          <View>
            <Text style={[s.airlineName, scriptFont(segment.airlineName)]}>{segment.airlineName ?? segment.flightNumber ?? "Airline to be confirmed"}</Text>
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

export function Meta({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={pdfStyles.metaCell}>
      <Text style={pdfStyles.metaLabel}>{label}</Text>
      <Text style={[pdfStyles.metaValue, scriptFont(value)]}>{value ?? "—"}</Text>
    </View>
  );
}

/** A titled block of free text, in the Persian font when it contains Persian. */
export function Paragraph({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <View wrap={false}>
      <Text style={pdfStyles.sectionTitle}>{title}</Text>
      <Text style={[pdfStyles.paragraph, scriptFont(text)]}>{text}</Text>
    </View>
  );
}

export function BulletList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <View wrap={false}>
      <Text style={pdfStyles.sectionTitle}>{title}</Text>
      {items.map((t) => (
        <View key={t} style={pdfStyles.term}>
          <Text style={pdfStyles.bullet}>•</Text>
          <Text style={{ flex: 1 }}>{t}</Text>
        </View>
      ))}
    </View>
  );
}
