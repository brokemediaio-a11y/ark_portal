import { Font, Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import { brand } from "@/config/brand";

/** Header and footer shared by every Ark Travelers PDF (quotations and e-tickets). */

const c = brand.colors;
export const PERSIAN_FONT = "Vazirmatn";

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

/** The page's side padding; the header band runs edge to edge, so it uses negative margins. */
export const PAGE_PADDING_X = 40;

const s = StyleSheet.create({
  band: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.primary,
    marginTop: -36,
    marginHorizontal: -PAGE_PADDING_X,
    paddingHorizontal: PAGE_PADDING_X,
    paddingVertical: 14,
  },
  logoCell: { width: 130 },
  logo: { height: 62, width: 72, objectFit: "contain" },
  centre: { flex: 1, alignItems: "center" },
  legalName: { fontSize: 15, fontFamily: "Helvetica-Bold", color: c.ink },
  localName: { fontSize: 13, fontFamily: PERSIAN_FONT, color: c.ink, marginTop: 2 },
  contact: { width: 130, alignItems: "flex-end", fontSize: 8.5, color: c.ink, lineHeight: 1.45 },
  footer: {
    position: "absolute",
    bottom: 26,
    left: PAGE_PADDING_X,
    right: PAGE_PADDING_X,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1.5,
    borderTopColor: c.primary,
    paddingTop: 7,
    fontSize: 7.5,
    color: c.muted,
  },
});

export function BrandHeader({ logoSrc }: { logoSrc: string | null }) {
  return (
    <View style={s.band}>
      <View style={s.logoCell}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
        {logoSrc && <Image src={logoSrc} style={s.logo} />}
      </View>
      <View style={s.centre}>
        <Text style={s.legalName}>{brand.legalName}</Text>
        <Text style={s.localName}>{brand.localName}</Text>
      </View>
      <View style={s.contact}>
        {brand.contact.phones.map((phone) => (
          <Text key={phone}>{phone}</Text>
        ))}
        <Text>{brand.contact.email}</Text>
        <Text>{brand.contact.website}</Text>
      </View>
    </View>
  );
}

/** Fixed to every page: company, address and page numbers, with an optional warning first. */
export function BrandFooter({ reference, warning }: { reference: string; warning?: string | null }) {
  return (
    <View style={s.footer} fixed>
      <Text>{warning ? `${warning} · ` : ""}{brand.legalName} · {brand.contact.address}</Text>
      <Text render={({ pageNumber, totalPages }) => `${reference} · Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}
