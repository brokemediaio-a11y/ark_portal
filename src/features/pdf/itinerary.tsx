import { G, Image, Line, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { brand } from "@/config/brand";
import type { CustomerSegment } from "@/features/quotation/customer-view";
import { Icon, KEEP_WORDS, PERSIAN_FONT, PLANE_PATH, scriptFont } from "./brand-frame";
import type { FlightConnection } from "@/features/quotation/journey-timing";
import type { ReactNode } from "react";
import { useMobilePdf } from "./layout";

/** Flight cards and page styles shared by the quotation and the e-ticket. */

const c = brand.colors;

/** Small, quiet type with generous spacing: hierarchy comes from weight, tracking and rules, not size. */
export const pdfStyles = StyleSheet.create({
  page: { paddingTop: 32, fontSize: 8.5, fontFamily: "Helvetica", color: c.ink },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 18, marginBottom: 12 },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", color: c.ink, letterSpacing: 0.3 },
  subtitle: { fontSize: 8.5, color: c.muted, marginTop: 3, letterSpacing: 0.4 },
  metaGrid: { flexDirection: "row", borderTopWidth: 0.75, borderBottomWidth: 0.75, borderColor: c.border, paddingVertical: 8, marginBottom: 16 },
  metaCell: { flex: 1, paddingRight: 8 },
  mobileMetaGrid: { flexWrap: "wrap", paddingBottom: 2 },
  mobileMetaCell: { flexGrow: 0, flexShrink: 0, flexBasis: "50%", marginBottom: 6 },
  metaLabel: { fontSize: 6, color: c.muted, textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 3 },
  metaValue: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  sectionTitle: { fontSize: 7, fontFamily: "Helvetica-Bold", color: c.muted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 7, marginTop: 6 },
  paragraph: { fontSize: 7.5, lineHeight: 1.5, color: c.ink, marginBottom: 12 },
  term: { flexDirection: "row", fontSize: 7, color: c.muted, lineHeight: 1.5, marginBottom: 1.5 },
  bullet: { width: 9 },
  warning: { backgroundColor: "#D64545", color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 8, letterSpacing: 0.6, textAlign: "center", paddingVertical: 5, borderRadius: 3, marginTop: 12 },
});

const s = StyleSheet.create({
  segment: { borderWidth: 0.75, borderColor: c.border, borderRadius: 5, marginBottom: 7 },
  segmentHead: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.surface,
    borderBottomWidth: 0.75, borderBottomColor: c.primary, paddingVertical: 5, paddingHorizontal: 10, borderTopLeftRadius: 5, borderTopRightRadius: 5,
  },
  segmentTitle: { fontSize: 6.5, color: c.muted, textTransform: "uppercase", letterSpacing: 1.1 },
  airline: { flexDirection: "row", alignItems: "center" },
  airlineLogo: { width: 18, height: 18, objectFit: "contain", marginRight: 7 },
  airlineBadge: { width: 18, height: 18, borderRadius: 3, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", marginRight: 7 },
  airlineBadgeText: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: c.ink },
  airlineName: { fontFamily: "Helvetica-Bold", fontSize: 8, color: c.ink, letterSpacing: 0.3 },
  segmentFlight: { fontSize: 7, color: c.muted, marginTop: 0.5 },
  segmentBody: { flexDirection: "row", alignItems: "center", paddingVertical: 7, paddingHorizontal: 10 },
  point: { flex: 1 },
  pointRight: { flex: 1, alignItems: "flex-end" },
  code: { fontSize: 14, fontFamily: "Helvetica-Bold", color: c.ink, letterSpacing: 0.5 },
  /** A place name standing in for a missing airport code: smaller, so long names don't wrap. */
  nameAsCode: { fontSize: 9, fontFamily: "Helvetica-Bold", color: c.ink, maxWidth: 170 },
  placeName: { fontSize: 6.5, color: c.muted, marginTop: 1, letterSpacing: 0.2 },
  when: { fontSize: 7.5, marginTop: 3 },
  routeBlock: { width: 110, alignItems: "center" },
  duration: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: c.ink, marginBottom: 2 },
  durationMissing: { fontSize: 6, color: c.muted, marginBottom: 2 },
  routeLine: { width: 92, height: 11, justifyContent: "center" },
  arrowLine: { width: 92, height: 0.75, backgroundColor: c.accent },
  routePlane: { position: "absolute", right: 0, top: 0, width: 11, height: 11 },
  stops: { fontSize: 6.5, color: c.muted, marginTop: 2 },
  details: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 10, paddingBottom: 7 },
  detail: { fontSize: 6.5, color: c.muted, marginRight: 12, letterSpacing: 0.2 },
  baggageBlock: { borderTopWidth: 0.5, borderTopColor: c.border, marginHorizontal: 10, paddingTop: 6, paddingBottom: 8 },
  baggageHeading: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  baggageTitle: { fontSize: 6, fontFamily: "Helvetica-Bold", color: c.muted, textTransform: "uppercase", letterSpacing: 1.1, marginLeft: 4 },
  baggageItems: { flexDirection: "row", paddingLeft: 13 },
  baggageItem: { flexDirection: "row", marginRight: 22 },
  baggageLabel: { fontSize: 7, color: c.muted, marginRight: 5 },
  baggageValue: { fontSize: 7, fontFamily: "Helvetica-Bold", color: c.ink },
  connection: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, marginTop: 2, marginBottom: 10 },
  dottedLine: { flex: 1, height: 2 },
  connectionBadge: { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 10, marginHorizontal: 10, maxWidth: 300 },
  connectionIcon: { width: 25, height: 25, borderRadius: 12.5, borderWidth: 0.6, borderColor: c.accent, backgroundColor: "#FFF6E7", alignItems: "center", justifyContent: "center", marginRight: 8 },
  connectionCopy: { flexShrink: 1 },
  connectionLabel: { fontSize: 5.5, letterSpacing: 0.9, color: c.muted, textTransform: "uppercase", marginBottom: 3 },
  connectionTime: { fontSize: 8, fontFamily: "Helvetica-Bold", color: c.ink },
  /** Mobile: a shorter route line leaves the airports room for their names, dates and times. */
  mobileRouteBlock: { width: 62 },
  mobileRouteLine: { width: 50 },
  mobileNameAsCode: { maxWidth: 82 },
  mobileBaggageItems: { flexWrap: "wrap" },
  mobileBaggageItem: { marginRight: 14, marginBottom: 2 },
  mobileConnectionBadge: { maxWidth: 190, marginHorizontal: 6 },
});

function Point({ point, align }: { point: CustomerSegment["from"]; align: "left" | "right" }) {
  const mobile = useMobilePdf();
  const when = [point.date, point.time].filter(Boolean);
  return (
    <View style={align === "left" ? s.point : s.pointRight}>
      {/* Some tickets print only the airport's name: it then takes the code's place. */}
      <Text {...KEEP_WORDS} style={[point.code ? s.code : mobile ? [s.nameAsCode, s.mobileNameAsCode] : s.nameAsCode, scriptFont(point.code ?? point.name)].flat()}>{point.code ?? point.name ?? "—"}</Text>
      {point.code && point.name && <Text {...KEEP_WORDS} style={[s.placeName, scriptFont(point.name), mobile ? { textAlign: align } : {}]}>{point.name}</Text>}
      {point.terminal && <Text style={s.placeName}>Terminal {point.terminal}</Text>}
      {/* On a phone the date and time each get their own line rather than wrapping mid-way. */}
      {mobile && when.length ? (
        when.map((part, i) => <Text key={i} style={i === 0 ? s.when : [s.when, { marginTop: 0.5, fontFamily: "Helvetica-Bold" }]}>{part}</Text>)
      ) : (
        <Text style={s.when}>{when.join("  ·  ") || "—"}</Text>
      )}
    </View>
  );
}

/** The line between the two airports: flight time above, a plane heading to the destination, stops below. */
function Route({ segment }: { segment: CustomerSegment }) {
  const mobile = useMobilePdf();
  return (
    <View style={mobile ? [s.routeBlock, s.mobileRouteBlock] : s.routeBlock}>
      <Text style={[segment.duration ? s.duration : s.durationMissing, mobile ? { textAlign: "center" } : {}]}>{segment.duration ?? "Duration unavailable"}</Text>
      <View style={mobile ? [s.routeLine, s.mobileRouteLine] : s.routeLine}>
        <View style={mobile ? [s.arrowLine, s.mobileRouteLine] : s.arrowLine} />
        <Svg viewBox="0 0 24 24" style={s.routePlane}>
          <G transform="rotate(45 12 12)">
            <Path d={PLANE_PATH} fill={c.accent} />
          </G>
        </Svg>
      </View>
      {segment.stops && <Text style={[s.stops, mobile ? { textAlign: "center" } : {}]}>{segment.stops}</Text>}
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

/** "Baggage" with its icon, then only the allowances that are known. */
function BaggageBlock({ baggage }: { baggage: NonNullable<CustomerSegment["baggage"]> }) {
  const mobile = useMobilePdf();
  const items = [
    ["Hand carry", baggage.handCarry],
    ["Check in", baggage.checkIn],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  return (
    <View style={s.baggageBlock}>
      <View style={s.baggageHeading}>
        <Icon name="luggage" size={8} color={c.muted} />
        <Text style={s.baggageTitle}>Baggage</Text>
      </View>
      <View style={mobile ? [s.baggageItems, s.mobileBaggageItems] : s.baggageItems}>
        {items.map(([label, value]) => (
          <View key={label} style={mobile ? [s.baggageItem, s.mobileBaggageItem] : s.baggageItem}>
            <Text style={s.baggageLabel}>{label}</Text>
            <Text {...KEEP_WORDS} style={[s.baggageValue, scriptFont(value)]}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function FlightCard({ segment, logo }: { segment: CustomerSegment; logo: string | undefined }) {
  // Mobile pages have a fixed height: the card keeps its natural size and moves to the next page if it does not fit.
  return (
    <View style={useMobilePdf() ? [s.segment, { flexShrink: 0 }] : s.segment} wrap={false}>
      <View style={s.segmentHead}>
        <View style={s.airline}>
          <AirlineMark segment={segment} src={logo} />
          <View>
            <Text {...KEEP_WORDS} style={[s.airlineName, scriptFont(segment.airlineName)]}>{segment.airlineName ?? segment.flightNumber ?? "Airline to be confirmed"}</Text>
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
      {segment.baggage && <BaggageBlock baggage={segment.baggage} />}
    </View>
  );
}

function DottedLine() {
  return <Svg viewBox="0 0 160 2" preserveAspectRatio="none" style={s.dottedLine}><Line x1="0" y1="1" x2="160" y2="1" stroke={c.primary} strokeWidth={1} strokeDasharray="2 4" strokeLinecap="round" /></Svg>;
}

function ConnectionSeparator({ connection }: { connection: FlightConnection }) {
  const mobile = useMobilePdf();
  const { kind, location, duration } = connection;
  const label = kind === "transfer" ? "Change of airport" : kind === "stay" ? `Stay in ${location}` : location ? `Connection in ${location}` : "Next flight";
  const detail = kind === "transfer" ? location : kind === "invalid" ? "Check connection dates and times" : duration ? `${duration} ${kind === "stay" ? "between flights" : "layover"}` : "Connection time unavailable";
  return (
    <View style={s.connection} wrap={false}>
      <DottedLine />
      <View style={mobile ? [s.connectionBadge, s.mobileConnectionBadge] : s.connectionBadge}>
        <View style={s.connectionIcon}>
          <Svg viewBox="0 0 24 24" style={{ width: 13, height: 13 }}><G transform="rotate(45 12 12)"><Path d={PLANE_PATH} fill={c.accent} /></G></Svg>
        </View>
        <View style={s.connectionCopy}>
          <Text {...KEEP_WORDS} style={[s.connectionLabel, scriptFont(label)]}>{label}</Text>
          <Text style={s.connectionTime}>{detail}</Text>
        </View>
      </View>
      <DottedLine />
    </View>
  );
}

/** One shared itinerary keeps the duration and connection presentation identical in both PDFs. */
export function FlightItinerary({ title, segments, airlineLogos }: { title: string; segments: CustomerSegment[]; airlineLogos: Record<string, string> }) {
  const mobile = useMobilePdf();
  const heading = <Text style={pdfStyles.sectionTitle}>{title}</Text>;
  if (mobile && segments.length) {
    // Each flight, with the connection that leads into it, is one unbreakable block placed straight on the page,
    // so a phone page never cuts a card in half: a card that does not fit starts the next page.
    // The section title travels with the first card, so it is never left alone at the bottom of a page.
    return <>{segments.map((segment, index) => (
      <View key={index} wrap={false} style={{ flexShrink: 0 }}>
        {index === 0 && heading}
        {index > 0 && segment.connectionBefore && <ConnectionSeparator connection={segment.connectionBefore} />}
        <FlightCard segment={segment} logo={segment.airlineCode ? airlineLogos[segment.airlineCode] : undefined} />
      </View>
    ))}</>;
  }
  return <View>{heading}{segments.map((segment, index) => <View key={index}>
    {index > 0 && segment.connectionBefore && <ConnectionSeparator connection={segment.connectionBefore} />}
    <FlightCard segment={segment} logo={segment.airlineCode ? airlineLogos[segment.airlineCode] : undefined} />
  </View>)}</View>;
}

/** The row of reference details under the title; two columns on a phone. */
export function MetaGrid({ children }: { children: ReactNode }) {
  return <View style={useMobilePdf() ? [pdfStyles.metaGrid, pdfStyles.mobileMetaGrid] : pdfStyles.metaGrid}>{children}</View>;
}

export function Meta({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={useMobilePdf() ? [pdfStyles.metaCell, pdfStyles.mobileMetaCell] : pdfStyles.metaCell}>
      <Text style={pdfStyles.metaLabel}>{label}</Text>
      <Text {...KEEP_WORDS} style={[pdfStyles.metaValue, scriptFont(value)]}>{value ?? "—"}</Text>
    </View>
  );
}

/** A titled block of free text, in the Persian font when it contains Persian. */
export function Paragraph({ title, text }: { title: string; text: string | null }) {
  const mobile = useMobilePdf();
  if (!text) return null;
  return (
    <View wrap={mobile}>
      <Text style={pdfStyles.sectionTitle} minPresenceAhead={30}>{title}</Text>
      <Text {...KEEP_WORDS} style={[pdfStyles.paragraph, scriptFont(text)]}>{text}</Text>
    </View>
  );
}

const notes = StyleSheet.create({
  columns: { flexDirection: "row", alignItems: "flex-start" },
  english: { flex: 1, paddingRight: 14 },
  dari: { flex: 1, paddingLeft: 14, borderLeftWidth: 0.5, borderLeftColor: c.border },
  dariTitle: { fontFamily: PERSIAN_FONT, fontSize: 8.5, color: c.muted },
  dariTerm: { flexDirection: "row-reverse", marginBottom: 2 },
  dariBullet: { width: 9, fontSize: 7, color: c.muted, textAlign: "right" },
  dariText: { fontFamily: PERSIAN_FONT, fontSize: 7.5, color: c.muted, lineHeight: 1.55 },
  dariWords: { flexDirection: "row-reverse", flexWrap: "wrap" },
  /** Beside a bullet the words take the rest of the row. */
  dariWordsFill: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  /** Mobile: larger notes, so the terms read comfortably on a phone without zooming. */
  mobileTitle: { fontSize: 9, marginBottom: 8 },
  mobileTerm: { fontSize: 9.5, lineHeight: 1.5, marginBottom: 3 },
  mobileBullet: { width: 11 },
  mobileDariTitle: { fontFamily: PERSIAN_FONT, fontSize: 11, color: c.muted },
  mobileDariBullet: { width: 11, fontSize: 9.5, color: c.muted, textAlign: "right" },
  mobileDariText: { fontFamily: PERSIAN_FONT, fontSize: 10, color: c.muted, lineHeight: 1.55 },
});

const MOBILE_DARI_TITLE_SIZE = 11;
const MOBILE_DARI_TEXT_SIZE = 10;

const RTL_LETTER = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/**
 * Splits text at spaces into the units a line may break between. Consecutive tokens with no right-to-left letters
 * (English words, numbers) stay together so they keep their own reading order inside the right-to-left line.
 */
export function dariWordChunks(text: string): string[] {
  const chunks: string[] = [];
  let ltr = false;
  for (const token of text.trim().split(/\s+/).filter(Boolean)) {
    const isLtr = !RTL_LETTER.test(token);
    if (isLtr && ltr && chunks.length) chunks[chunks.length - 1] += ` ${token}`;
    else chunks.push(token);
    ltr = isLtr;
  }
  return chunks;
}

const MIRRORED: Record<string, string> = { "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{", "«": "»", "»": "«" };
const mirror = (marks: string) => [...marks].reverse().map((m) => MIRRORED[m] ?? m).join("");

/**
 * A single Dari word set on its own is laid out left to right, which would put its punctuation on the wrong side
 * («.شماست»). Punctuation at the end of the word is moved before it, and punctuation at the start after it, so they
 * appear where a right-to-left reader expects them.
 */
export function rtlWordForDisplay(word: string): string {
  if (!RTL_LETTER.test(word)) return word;
  const [, lead, core, trail] = word.match(/^([^\p{L}\p{N}\p{M}‌‍]*)(.*?)([^\p{L}\p{N}\p{M}‌‍]*)$/u) ?? [];
  return `${mirror(trail ?? "")}${core ?? word}${mirror(lead ?? "")}`;
}

/**
 * Right-to-left text laid out one word per box, so a line can only ever break at a space and the letters of a word
 * always stay together, whatever the PDF engine's own line breaking would do.
 */
function DariWords({ text, style, fontSize, fill = false }: { text: string; style: typeof notes.dariTitle | typeof notes.dariText; fontSize: number; fill?: boolean }) {
  const chunks = dariWordChunks(text);
  const space = fontSize * 0.3;
  return (
    <View style={fill ? [notes.dariWords, notes.dariWordsFill] : notes.dariWords}>
      {chunks.map((word, i) => (
        <Text key={i} {...KEEP_WORDS} style={[style, { marginLeft: i < chunks.length - 1 ? space : 0 }]}>{rtlWordForDisplay(word)}</Text>
      ))}
    </View>
  );
}

/** English notes on the left and Dari on the right; either column fills the width when the other is empty. */
export function BilingualNotes({ title, dariTitle, items, dariItems }: { title: string; dariTitle: string; items: string[]; dariItems: string[] }) {
  const mobile = useMobilePdf();
  if (!items.length && !dariItems.length) return null;
  const both = items.length > 0 && dariItems.length > 0;
  if (mobile) {
    // A phone page is too narrow for two columns: English first, then the Dari underneath.
    // Each point is its own block straight on the page, so the notes fill what is left of a page and continue on
    // the next one; a heading always stays with its first point.
    const englishTitle = <Text style={[pdfStyles.sectionTitle, notes.mobileTitle]}>{title}</Text>;
    const dariHeading = (
      <View style={{ marginBottom: 6, marginTop: items.length ? 14 : 4, paddingBottom: 3 }}>
        <DariWords text={dariTitle} style={notes.mobileDariTitle} fontSize={MOBILE_DARI_TITLE_SIZE} />
      </View>
    );
    return (
      <>
        {items.map((t, i) => (
          <View key={`en-${i}`} wrap={false} style={{ flexShrink: 0 }}>
            {i === 0 && englishTitle}
            <EnglishPoint text={t} mobile />
          </View>
        ))}
        {dariItems.map((t, i) => (
          <View key={`fa-${i}`} wrap={false} style={{ flexShrink: 0 }}>
            {i === 0 && dariHeading}
            <DariPoint text={t} mobile />
          </View>
        ))}
      </>
    );
  }
  return (
    <View wrap={false} style={notes.columns}>
      {items.length > 0 && (
        <View style={both ? notes.english : { flex: 1 }}>
          <BulletList title={title} items={items} />
        </View>
      )}
      {dariItems.length > 0 && (
        <View style={both ? notes.dari : { flex: 1 }}>
          <DariNotes title={dariTitle} items={dariItems} />
        </View>
      )}
    </View>
  );
}

function DariNotes({ title, items }: { title: string; items: string[] }) {
  return (
    <>
      <View style={{ marginBottom: 5, marginTop: 4, paddingBottom: 3 }}>
        <DariWords text={title} style={notes.dariTitle} fontSize={8.5} />
      </View>
      {items.map((t) => <DariPoint key={t} text={t} />)}
    </>
  );
}

function DariPoint({ text, mobile = false }: { text: string; mobile?: boolean }) {
  return (
    <View style={mobile ? [notes.dariTerm, { marginBottom: 3 }] : notes.dariTerm}>
      <Text style={mobile ? notes.mobileDariBullet : notes.dariBullet}>•</Text>
      <DariWords text={text} style={mobile ? notes.mobileDariText : notes.dariText} fontSize={mobile ? MOBILE_DARI_TEXT_SIZE : 7.5} fill />
    </View>
  );
}

function EnglishPoint({ text, mobile = false }: { text: string; mobile?: boolean }) {
  return (
    <View style={mobile ? [pdfStyles.term, notes.mobileTerm] : pdfStyles.term}>
      <Text style={mobile ? [pdfStyles.bullet, notes.mobileBullet] : pdfStyles.bullet}>•</Text>
      <Text style={{ flex: 1 }}>{text}</Text>
    </View>
  );
}

export function BulletList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <View wrap={false}>
      <Text style={pdfStyles.sectionTitle}>{title}</Text>
      {items.map((t) => <EnglishPoint key={t} text={t} />)}
    </View>
  );
}
