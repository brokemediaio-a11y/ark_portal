/**
 * Supplier PDFs sometimes print look-alike characters: "18∶15" written with the ratio sign (U+2236) instead of a
 * colon, a full-width colon, a minus sign or a non-breaking hyphen for a dash, or a narrow no-break space before
 * "PM". They read the same to a person but not to a pattern or the AI, so a time like "18∶15" was never recognised.
 * Every document's text is turned into the plain characters before anything reads it.
 */
const LOOKALIKES: [RegExp, string][] = [
  // Colons: ratio, full-width, small, vertical presentation form, modifier letter colons, Armenian full stop.
  [/[∶：﹕︓꞉˸ː։]/g, ":"],
  // Dashes: hyphen, non-breaking hyphen, figure dash, en and em dash, horizontal bar, minus, small and full-width hyphen-minus.
  [/[‐-―−﹣－]/g, "-"],
  // Spaces: no-break, narrow no-break, figure, thin, hair and the other fixed-width spaces, ideographic space.
  [/[  -  　]/g, " "],
  // Zero-width characters that only split words or numbers apart. ZWNJ (U+200C) stays: Persian spelling needs it.
  [/[​⁠﻿]/g, ""],
];

export function normalizeDocumentText(text: string): string {
  const plain = LOOKALIKES.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
  // Full-width digits ("１８") become ASCII digits.
  return plain.replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xff10));
}
