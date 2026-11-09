import { Circle, Defs, Font, G, Image, Line, LinearGradient, Link, Path, Rect, Stop, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { brand } from "@/config/brand";

/** Header and closing footer shared by every Ark Travelers PDF (quotations and e-tickets). */

const c = brand.colors;
export const PERSIAN_FONT = "Vazirmatn";

/** Closing footer palette: deep ink, like the website's footer. */
const DARK = { from: "#141C25", to: "#26313D", text: "#E8EDF1", muted: "#9AA7B3", rule: "#3A4652" };

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
export const scriptFont = (text: string | null | undefined) => (text && ARABIC_SCRIPT.test(text) ? { fontFamily: PERSIAN_FONT } : {});

/** Drawn rather than typed, because the PDF's built-in font has no plane or arrow glyph. */
export const PLANE_PATH =
  "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z";

export const PAGE_PADDING_X = 40;

/* ---------- Icons (outline icons from the Lucide set, drawn as vectors) ---------- */

type IconName = "phone" | "mail" | "globe" | "pin" | "facebook" | "instagram";

function Icon({ name, size = 9, color }: { name: IconName; size?: number; color: string }) {
  const stroke = { stroke: color, strokeWidth: 1.8, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <Svg viewBox="0 0 24 24" style={{ width: size, height: size }}>
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
  header: { flexDirection: "row", alignItems: "center", paddingBottom: 12, borderBottomWidth: 0.75, borderBottomColor: c.primary },
  logoCell: { width: 150 },
  logoTile: { width: 42, height: 42, borderRadius: 6, backgroundColor: c.primary, justifyContent: "center", alignItems: "center" },
  logo: { width: 34, height: 30, objectFit: "contain" },
  centre: { flex: 1, alignItems: "center" },
  legalName: { fontSize: 11.5, fontFamily: "Helvetica-Bold", color: c.ink, letterSpacing: 0.4 },
  localName: { fontSize: 9.5, fontFamily: PERSIAN_FONT, color: c.muted, marginTop: 1 },
  contacts: { width: 150, alignItems: "flex-end" },
  contactRow: { flexDirection: "row", alignItems: "center", marginBottom: 2.5 },
  contactText: { fontSize: 7.5, color: c.ink, marginLeft: 4, textDecoration: "none" },
});

function HeaderContact({ icon, children, href }: { icon: IconName; children: string; href?: string }) {
  return (
    <View style={h.contactRow}>
      <Icon name={icon} size={7.5} color={c.muted} />
      {href ? <Link src={href} style={h.contactText}>{children}</Link> : <Text style={h.contactText}>{children}</Text>}
    </View>
  );
}

export function BrandHeader({ logoSrc }: { logoSrc: string | null }) {
  return (
    <View style={h.header}>
      <View style={h.logoCell}>
        <View style={h.logoTile}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          {logoSrc && <Image src={logoSrc} style={h.logo} />}
        </View>
      </View>
      <View style={h.centre}>
        <Text style={h.legalName}>{brand.legalName}</Text>
        <Text style={h.localName}>{brand.localName}</Text>
      </View>
      <View style={h.contacts}>
        {brand.contact.phones.map((phone) => (
          <HeaderContact key={phone} icon="phone" href={`tel:${phone.replace(/\s+/g, "")}`}>{phone}</HeaderContact>
        ))}
        <HeaderContact icon="mail" href={`mailto:${brand.contact.email}`}>{brand.contact.email}</HeaderContact>
        <HeaderContact icon="globe" href={brand.contact.websiteUrl}>{brand.contact.website}</HeaderContact>
      </View>
    </View>
  );
}

/* ---------- Closing footer (end of the document only) ---------- */

const f = StyleSheet.create({
  wrap: { flexShrink: 0, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, overflow: "hidden" },
  background: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  body: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: PAGE_PADDING_X },
  left: { width: 125 },
  logo: { width: 34, height: 29, objectFit: "contain", marginBottom: 5 },
  label: { fontSize: 6, color: DARK.muted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 },
  socialRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  socialBadge: { width: 14, height: 14, borderRadius: 7, borderWidth: 0.75, borderColor: DARK.rule, justifyContent: "center", alignItems: "center", marginRight: 6 },
  link: { fontSize: 7.5, color: DARK.text, textDecoration: "none" },
  centre: { flex: 1, alignItems: "center", paddingHorizontal: 10 },
  illustration: { width: 150, height: 34, marginBottom: 3 },
  thanks: { fontSize: 6.5, color: DARK.muted, textTransform: "uppercase", letterSpacing: 2 },
  thanksName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: DARK.text, marginTop: 3, letterSpacing: 0.5 },
  tagline: { fontSize: 6.5, color: c.primary, marginTop: 4, fontFamily: "Helvetica-Oblique" },
  right: { width: 150 },
  contactRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 3 },
  contactText: { fontSize: 7.5, color: DARK.text, marginLeft: 6, textDecoration: "none", flex: 1, lineHeight: 1.35 },
  bottom: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: DARK.rule, paddingVertical: 5, paddingHorizontal: PAGE_PADDING_X },
  small: { fontSize: 6.5, color: DARK.muted },
});

/** A plane flying a dashed great-circle route between two airports, over a faint globe. */
function TravelIllustration() {
  return (
    <Svg viewBox="0 0 190 46" style={f.illustration}>
      <Circle cx="95" cy="70" r="62" stroke={DARK.rule} strokeWidth={0.6} fill="none" />
      <Path d="M33 70 C 33 34, 157 34, 157 70" stroke={DARK.rule} strokeWidth={0.5} fill="none" />
      <Path d="M58 70 C 58 26, 132 26, 132 70" stroke={DARK.rule} strokeWidth={0.5} fill="none" />
      <Path d="M18 38 C 60 6, 128 6, 170 30" stroke={c.primary} strokeWidth={1} strokeDasharray="2.5 3" fill="none" />
      <Circle cx="18" cy="38" r="2.4" fill={c.primary} />
      <Circle cx="170" cy="30" r="2.4" fill={c.accent} />
      <G transform="translate(116 4) scale(0.62) rotate(70 12 12)">
        <Path d={PLANE_PATH} fill="#FFFFFF" />
      </G>
    </Svg>
  );
}

function ClosingContact({ icon, children, href }: { icon: IconName; children: string; href?: string }) {
  return (
    <View style={f.contactRow}>
      <Icon name={icon} size={8.5} color={c.primary} />
      {href ? <Link src={href} style={f.contactText}>{children}</Link> : <Text style={f.contactText}>{children}</Text>}
    </View>
  );
}

/**
 * The closing block of every PDF: logo and social links, a thank-you with a travel
 * illustration, and every way to reach Ark Travelers. Printed once, after the content.
 */
export function BrandClosing({ logoSrc, reference }: { logoSrc: string | null; reference: string }) {
  return (
    <View style={f.wrap} wrap={false}>
      <Svg style={f.background} viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="closing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={DARK.from} />
            <Stop offset="1" stopColor={DARK.to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#closing)" />
      </Svg>

      <View style={f.body}>
        <View style={f.left}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          {logoSrc && <Image src={logoSrc} style={f.logo} />}
          <Text style={f.label}>Follow us</Text>
          {brand.social.map((s) => (
            <View key={s.network} style={f.socialRow}>
              <View style={f.socialBadge}>
                <Icon name={s.network as IconName} size={8} color={DARK.text} />
              </View>
              <Link src={s.url} style={f.link}>{s.label}</Link>
            </View>
          ))}
        </View>

        <View style={f.centre}>
          <TravelIllustration />
          <Text style={f.thanks}>Thank you for choosing</Text>
          <Text style={f.thanksName}>Ark Travelers</Text>
          <Text style={f.tagline}>{brand.tagline}</Text>
        </View>

        <View style={f.right}>
          <Text style={f.label}>Contact us</Text>
          {brand.contact.phones.map((phone) => (
            <ClosingContact key={phone} icon="phone" href={`tel:${phone.replace(/\s+/g, "")}`}>{phone}</ClosingContact>
          ))}
          <ClosingContact icon="mail" href={`mailto:${brand.contact.email}`}>{brand.contact.email}</ClosingContact>
          <ClosingContact icon="globe" href={brand.contact.websiteUrl}>{brand.contact.website}</ClosingContact>
          <ClosingContact icon="pin">{brand.contact.address}</ClosingContact>
        </View>
      </View>

      <View style={f.bottom}>
        <Text style={f.small}>© {new Date().getFullYear()} {brand.legalName}. All rights reserved.</Text>
        <Text style={f.small}>{reference}</Text>
      </View>
    </View>
  );
}
