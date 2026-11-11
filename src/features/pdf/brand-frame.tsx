import { Circle, Defs, Font, G, Image, Line, LinearGradient, Link, Path, Rect, Stop, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { brand } from "@/config/brand";
import { useMobilePdf } from "./layout";

/** Header and closing footer shared by every Ark Travelers PDF (quotations and e-tickets). */

const c = brand.colors;
export const PERSIAN_FONT = "Vazirmatn";

/**
 * Header and footer: the logo sits on its own #A4AFB9 tile, and the rest is a
 * square-cornered band fading from light blue on the right to white on the left,
 * ending before the logo tile. Text and icons on the band are black.
 */
const BAND = { blue: "#D9E8F5", white: "#FFFFFF", text: "#000000", muted: "#333333", rule: "#BFD1E2", line: "#9FB4C8" };
const LOGO_TILE_RADIUS = 6;
const BAND_GAP = 10;

/** The band's gradient: blue at the right edge, fading to white at the left. */
export function BandBackground({ id }: { id: string }) {
  return (
    <Svg style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        {/* Written left to right (white → blue): react-pdf doesn't draw gradients that run right to left. */}
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={BAND.white} />
          <Stop offset="1" stopColor={BAND.blue} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * Registers the Persian font: a URL in the browser, a file path in tests.
 * Safe to call before every render: react-pdf keeps the first registration.
 */
export function registerPdfFonts(persianFontSrc: string) {
  Font.register({ family: PERSIAN_FONT, src: persianFontSrc });
  // Never split words with a hyphen: names and codes must print whole.
  Font.registerHyphenationCallback((word) => [word]);
}

/** Persian/Arabic letters need the Persian font; the built-in fonts would print them as gibberish. */
const ARABIC_SCRIPT = /[؀-ۿﭐ-﷿ﹰ-﻿]/;
/**
 * react-pdf splits text into runs (at half-spaces, diacritics, digits…) and treats a
 * run boundary inside a word like a hyphenation point, so Persian words could be
 * split across lines (e.g. the tanwin of «لطفاً» moved to the next line). The
 * highest penalty forbids those breaks: lines then only break between words.
 */
export const KEEP_WORDS = { hyphenationPenalty: 10000 } as const;

export const scriptFont = (text: string | null | undefined) => (text && ARABIC_SCRIPT.test(text) ? { fontFamily: PERSIAN_FONT } : {});

/** Drawn rather than typed, because the PDF's built-in font has no plane or arrow glyph. */
export const PLANE_PATH =
  "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z";

export const PAGE_PADDING_X = 40;

/* ---------- Icons (outline icons from the Lucide set, drawn as vectors) ---------- */

export type IconName = "phone" | "mail" | "globe" | "pin" | "facebook" | "instagram" | "tiktok" | "whatsapp" | "luggage";

/** WhatsApp's own green, used for its icon in the footer. */
const WHATSAPP_GREEN = "#25D366";

/** Brand marks from Simple Icons (CC0), drawn filled rather than outlined. */
const FILLED_ICONS: Partial<Record<IconName, string>> = {
  whatsapp:
    "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z",
  tiktok:
    "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
};

export function Icon({ name, size = 9, color }: { name: IconName; size?: number; color: string }) {
  const stroke = { stroke: color, strokeWidth: 1.8, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <Svg viewBox="0 0 24 24" style={{ width: size, height: size }}>
      {FILLED_ICONS[name] && <Path d={FILLED_ICONS[name]} fill={color} />}
      {name === "phone" && (
        <Path {...stroke} d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      )}
      {name === "mail" && (
        <G>
          <Rect {...stroke} x="2" y="4" width="20" height="16" rx="2" />
          <Path {...stroke} d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </G>
      )}
      {name === "globe" && (
        <G>
          <Circle {...stroke} cx="12" cy="12" r="10" />
          <Path {...stroke} d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <Path {...stroke} d="M2 12h20" />
        </G>
      )}
      {name === "luggage" && (
        <G>
          <Path {...stroke} d="M6 20a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2" />
          <Path {...stroke} d="M8 18V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14" />
          <Path {...stroke} d="M10 20h4" />
          <Circle {...stroke} cx="16" cy="20" r="2" />
          <Circle {...stroke} cx="8" cy="20" r="2" />
        </G>
      )}
      {name === "pin" && (
        <G>
          <Path {...stroke} d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
          <Circle {...stroke} cx="12" cy="10" r="3" />
        </G>
      )}
      {name === "facebook" && <Path {...stroke} d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />}
      {name === "instagram" && (
        <G>
          <Rect {...stroke} x="2" y="2" width="20" height="20" rx="5" />
          <Path {...stroke} d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <Line {...stroke} x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </G>
      )}
    </Svg>
  );
}

/* ---------- Header ---------- */

const h = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "stretch" },
  logoTile: { width: 66, borderRadius: LOGO_TILE_RADIUS, backgroundColor: c.primary, justifyContent: "center", alignItems: "center", marginRight: BAND_GAP },
  logo: { width: 46, height: 40, objectFit: "contain" },
  band: { flex: 1, flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14 },
  centre: { flex: 1, alignItems: "center" },
  legalName: { fontSize: 11.5, fontFamily: "Helvetica-Bold", color: BAND.text, letterSpacing: 0.4 },
  localName: { fontSize: 9.5, fontFamily: PERSIAN_FONT, color: BAND.muted, marginTop: 1 },
  contacts: { width: 140, alignItems: "flex-end" },
  contactRow: { flexDirection: "row", alignItems: "center", marginBottom: 2.5 },
  contactText: { fontSize: 7.5, color: BAND.text, marginLeft: 4, textDecoration: "none" },
});

/**
 * Mobile: the same single-row header, scaled down to the phone page. The names take whatever width the logo
 * and contacts leave, so the row is always full.
 */
const MOBILE_HEADER_HEIGHT = 42;

const hm = StyleSheet.create({
  header: {},
  /** A square tile; the band beside it is held to the same height. */
  logoTile: { width: MOBILE_HEADER_HEIGHT, height: MOBILE_HEADER_HEIGHT, borderRadius: 4, marginRight: 5 },
  logo: { width: 29, height: 26 },
  band: { height: MOBILE_HEADER_HEIGHT, paddingVertical: 4, paddingHorizontal: 6 },
  centre: { paddingRight: 4 },
  legalName: { fontSize: 10.5, letterSpacing: 0.2 },
  localName: { fontSize: 8.5, marginTop: 1 },
  contacts: { width: "auto", flexShrink: 0 },
  contactRow: { marginBottom: 1.2 },
  contactText: { fontSize: 6, marginLeft: 2.5 },
});

type HeaderPart = keyof typeof h;
function useHeaderStyle() {
  const mobile = useMobilePdf();
  return { mobile, st: (part: HeaderPart) => (mobile ? [h[part], hm[part]] : h[part]) };
}

function HeaderContact({ icon, children, href }: { icon: IconName; children: string; href?: string }) {
  const { mobile, st } = useHeaderStyle();
  return (
    <View style={st("contactRow")}>
      <Icon name={icon} size={mobile ? 6 : 7.5} color={BAND.text} />
      {href ? <Link src={href} style={st("contactText")}>{children}</Link> : <Text style={st("contactText")}>{children}</Text>}
    </View>
  );
}

export function BrandHeader({ logoSrc }: { logoSrc: string | null }) {
  const { st } = useHeaderStyle();
  return (
    <View style={st("header")}>
      <View style={st("logoTile")}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
        {logoSrc && <Image src={logoSrc} style={st("logo")} />}
      </View>
      <View style={st("band")}>
        <BandBackground id="header-band" />
        <View style={st("centre")}>
          <Text style={st("legalName")}>{brand.legalName}</Text>
          <Text {...KEEP_WORDS} style={st("localName")}>{brand.localName}</Text>
        </View>
        <View style={st("contacts")}>
          {brand.contact.phones.map((phone) => (
            <HeaderContact key={phone} icon="phone" href={`tel:${phone.replace(/\s+/g, "")}`}>{phone}</HeaderContact>
          ))}
          <HeaderContact icon="mail" href={`mailto:${brand.contact.email}`}>{brand.contact.email}</HeaderContact>
          <HeaderContact icon="globe" href={brand.contact.websiteUrl}>{brand.contact.website}</HeaderContact>
        </View>
      </View>
    </View>
  );
}

/* ---------- Closing footer (end of the document only) ---------- */

const FOOTER_SIDE_WIDTH = 150;
/** A small gap between the outer columns and the band's edges. Equal on both sides, so the centre stays centred. */
const FOOTER_EDGE_INSET = 5;

const f = StyleSheet.create({
  /** Kept inside the page margins, like the header. */
  wrap: { flexShrink: 0, marginHorizontal: PAGE_PADDING_X, marginBottom: 28 },
  /** No side padding: the outer columns sit on the page margins. Equal outer widths keep the centre column centred. */
  body: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  left: { width: FOOTER_SIDE_WIDTH, paddingLeft: FOOTER_EDGE_INSET },
  label: { fontSize: 6, color: BAND.muted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 },
  socialRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  socialBadge: { width: 14, height: 14, borderRadius: 7, borderWidth: 0.75, borderColor: BAND.rule, justifyContent: "center", alignItems: "center", marginRight: 6 },
  link: { fontSize: 7.5, color: BAND.text, textDecoration: "none" },
  centre: { flex: 1, alignItems: "center" },
  illustration: { width: 150, height: 34, marginBottom: 3 },
  thanks: { fontSize: 6.5, color: BAND.muted, textTransform: "uppercase", letterSpacing: 2 },
  thanksName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: BAND.text, marginTop: 3, letterSpacing: 0.5 },
  tagline: { fontSize: 6.5, color: BAND.muted, marginTop: 4, fontFamily: "Helvetica-Oblique" },
  right: { width: FOOTER_SIDE_WIDTH, alignItems: "flex-end", paddingRight: FOOTER_EDGE_INSET },
  /** Flush right, mirroring "Follow us" on the left margin. */
  contactRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "flex-start", marginBottom: 3 },
  contactText: { fontSize: 7.5, color: BAND.text, marginLeft: 6, textDecoration: "none", textAlign: "right", maxWidth: FOOTER_SIDE_WIDTH - 16, lineHeight: 1.35 },
  bottom: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: BAND.rule, paddingVertical: 5, paddingHorizontal: FOOTER_EDGE_INSET },
  small: { fontSize: 6.5, color: BAND.muted },
});

const fmPin = { marginTop: "auto", paddingTop: 8, flexShrink: 0 } as const;

const MOBILE_FOOTER_LEFT = 70;
const MOBILE_FOOTER_RIGHT = 98;
const MOBILE_FOOTER_INSET = 3;

/**
 * Mobile: the same three columns in one row — Follow us, the thank-you, Contact us — scaled down to the phone page.
 * The thank-you column takes the width the two sides leave.
 */
const fm = StyleSheet.create({
  wrap: { marginHorizontal: 0, marginTop: 0, marginBottom: 4 },
  body: { paddingVertical: 7 },
  left: { width: MOBILE_FOOTER_LEFT, paddingLeft: MOBILE_FOOTER_INSET },
  label: { fontSize: 4.6, letterSpacing: 0.6, marginBottom: 2.5 },
  socialRow: { marginBottom: 2 },
  socialBadge: { width: 9.5, height: 9.5, borderRadius: 4.75, borderWidth: 0.5, marginRight: 3 },
  link: { fontSize: 6 },
  centre: { paddingHorizontal: 3 },
  illustration: { width: 70, height: 17, marginBottom: 2 },
  thanks: { fontSize: 4.4, letterSpacing: 0.5 },
  thanksName: { fontSize: 9, marginTop: 2, letterSpacing: 0.3 },
  tagline: { fontSize: 4.8, marginTop: 2 },
  right: { width: MOBILE_FOOTER_RIGHT, paddingRight: MOBILE_FOOTER_INSET },
  contactRow: { marginBottom: 2 },
  contactText: { fontSize: 6, marginLeft: 3, maxWidth: MOBILE_FOOTER_RIGHT - MOBILE_FOOTER_INSET - 9, lineHeight: 1.3 },
  bottom: { paddingVertical: 3.5, paddingHorizontal: MOBILE_FOOTER_INSET, borderTopWidth: 0.4 },
  small: { fontSize: 4.6 },
});

type FooterPart = keyof typeof f;
function useFooterStyle() {
  const mobile = useMobilePdf();
  return { mobile, st: (part: FooterPart) => (mobile ? [f[part], fm[part]] : f[part]) };
}

/** A plane flying a dashed great-circle route between two airports, over a faint globe. */
function TravelIllustration() {
  const { st } = useFooterStyle();
  return (
    <Svg viewBox="0 0 190 46" style={st("illustration")}>
      <Circle cx="95" cy="70" r="62" stroke={BAND.line} strokeWidth={0.6} fill="none" />
      <Path d="M33 70 C 33 34, 157 34, 157 70" stroke={BAND.line} strokeWidth={0.5} fill="none" />
      <Path d="M58 70 C 58 26, 132 26, 132 70" stroke={BAND.line} strokeWidth={0.5} fill="none" />
      <Path d="M18 38 C 60 6, 128 6, 170 30" stroke={BAND.text} strokeWidth={0.9} strokeDasharray="2.5 3" fill="none" />
      <Circle cx="18" cy="38" r="2.4" fill={BAND.text} />
      <Circle cx="170" cy="30" r="2.4" fill={c.accent} />
      <G transform="translate(116 4) scale(0.62) rotate(70 12 12)">
        <Path d={PLANE_PATH} fill={BAND.text} />
      </G>
    </Svg>
  );
}

function ClosingContact({ icon, children, href }: { icon: IconName; children: string; href?: string }) {
  const { mobile, st } = useFooterStyle();
  return (
    <View style={st("contactRow")}>
      <Icon name={icon} size={mobile ? 6 : 8.5} color={icon === "whatsapp" ? WHATSAPP_GREEN : BAND.text} />
      {href ? <Link src={href} style={st("contactText")}>{children}</Link> : <Text style={st("contactText")}>{children}</Text>}
    </View>
  );
}

/**
 * The closing block of every PDF: social links, a thank-you with a travel
 * illustration, and every way to reach Ark Travelers. Printed once, after the content.
 */
export function BrandClosing({ reference }: { reference: string }) {
  const { mobile, st } = useFooterStyle();
  const closing = (
    <View style={st("wrap")} wrap={false}>
      <BandBackground id="footer-band" />
      <View style={st("body")}>
        <View style={st("left")}>
          <Text style={st("label")}>Follow us</Text>
          {brand.social.map((s) => (
            <View key={s.network} style={st("socialRow")}>
              <View style={st("socialBadge")}>
                <Icon name={s.network as IconName} size={mobile ? 5.6 : 8} color={BAND.text} />
              </View>
              <Link src={s.url} style={st("link")}>{s.label}</Link>
            </View>
          ))}
        </View>

        <View style={st("centre")}>
          <TravelIllustration />
          <Text style={st("thanks")}>Thank you for choosing</Text>
          <Text style={st("thanksName")}>Ark Travelers</Text>
          <Text style={st("tagline")}>{brand.tagline}</Text>
        </View>

        <View style={st("right")}>
          <Text style={st("label")}>Contact us</Text>
          {brand.contact.phones.map((phone) => (
            // The footer offers WhatsApp chats; the header keeps phone calls.
            <ClosingContact key={phone} icon="whatsapp" href={`https://wa.me/${phone.replace(/\D/g, "")}`}>{phone}</ClosingContact>
          ))}
          <ClosingContact icon="mail" href={`mailto:${brand.contact.email}`}>{brand.contact.email}</ClosingContact>
          <ClosingContact icon="globe" href={brand.contact.websiteUrl}>{brand.contact.website}</ClosingContact>
          <ClosingContact icon="pin">{brand.contact.address}</ClosingContact>
        </View>
      </View>

      <View style={st("bottom")}>
        <Text style={st("small")}>© {new Date().getFullYear()} {brand.legalName}. All rights reserved.</Text>
        <Text style={st("small")}>{reference}</Text>
      </View>
    </View>
  );
  // Mobile: the footer sits at the bottom of the last page, whether it follows the content or had to move to a page
  // of its own. The padding keeps a gap above it when the content fills the page.
  return mobile ? <View wrap={false} style={fmPin}>{closing}</View> : closing;
}
