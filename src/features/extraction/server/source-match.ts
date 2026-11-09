/**
 * Does a value the AI returned really appear in the document's text? Pure string
 * checks, independent of the model, tolerant of formatting ("TK1954" / "TK 1954",
 * "18:30" / "6:30 PM") but strict about the digits: TK 1953 never matches TK 1954.
 */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const SEPARATORS = "[\\s\\-./,]*";
const CURRENCY_SYMBOLS: Record<string, string> = { EUR: "€", GBP: "£", JPY: "¥", INR: "₹", USD: "US$" };

/** Lowercase, drop whitespace and punctuation so "30 KG" matches "30KG". */
const normalizeText = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export const textInSource = (value: string, source: string) => normalizeText(source).includes(normalizeText(value));

function flightNumberPattern(value: string): RegExp | null {
  const m = /^\s*([A-Za-z0-9]{2})[\s-]*0*(\d{1,4})[A-Za-z]?\s*$/.exec(value);
  if (m && /[A-Za-z]/.test(m[1])) return new RegExp(`(?<![A-Za-z0-9])${m[1]}[\\s|:-]*0*${m[2]}(?!\\d)`, "i");
  const digits = value.replace(/\D/g, "").replace(/^0+/, "");
  return digits.length > 0 ? new RegExp(`(?<!\\d)0*${digits}(?!\\d)`) : null;
}

export const flightNumberInSource = (value: string, source: string) => flightNumberPattern(value)?.test(source) ?? false;

/** Where a flight number first appears in the text, or -1. */
export const flightNumberIndex = (value: string, source: string) => flightNumberPattern(value)?.exec(source)?.index ?? -1;

/**
 * An airport code as a whole word ("IST" is not in "Istanbul"), or inside a
 * six-letter GDS city pair such as "LHEDOH".
 */
export function codeInSource(code: string, source: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return textInSource(code, source);
  return new RegExp(`(?<![A-Za-z])(?:${code}|${code}[A-Z]{3}|[A-Z]{3}${code})(?![A-Za-z])`).test(source);
}

/** Whether a piece of text contains any clock time or any date at all, used to tell "missing" from "different". */
export const hasClockTime = (text: string) => /(?<!\d)\d{1,2}[:.]\d{2}(?!\d)/.test(text);
export const hasDate = (text: string) =>
  new RegExp(`(?<!\\d)\\d{1,2}${SEPARATORS}(?:${MONTHS.join("|")})|(?:${MONTHS.join("|")})[a-z]*${SEPARATORS}\\d{1,2}(?!\\d)|(?<!\\d)\\d{1,4}[-./]\\d{1,2}[-./]\\d{1,4}`, "i").test(text);

export function timeInSource(value: string, source: string): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return false;
  const hour = Number(m[1]);
  const minute = m[2];
  const clock = (h: number) => `(?<!\\d)0?${h}[:.h]?${minute}(?!\\d)`;
  const suffix = hour < 12 ? "a" : "p";
  // A bare "06:30" is 24-hour; "6:30 PM" is not 06:30, so AM/PM swaps are caught.
  return (
    new RegExp(`${clock(hour)}(?!\\s*[ap]\\.?m?\\b)`, "i").test(source) ||
    new RegExp(`${clock(hour % 12 || 12)}\\s*${suffix}\\.?m?\\b`, "i").test(source)
  );
}

/** Ignores the year on purpose: documents often omit it, and it is resolved separately. */
export function dateInSource(value: string, source: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const name = m && MONTHS[Number(m[2]) - 1];
  if (!m || !name) return false;
  const month = Number(m[2]);
  const day = Number(m[3]);
  return [
    `(?<!\\d)0?${day}(?:st|nd|rd|th)?${SEPARATORS}${name}`,
    `${name}[a-z]*${SEPARATORS}0?${day}(?!\\d)`,
    `(?<!\\d)0?${day}[-./]0?${month}(?!\\d)`,
    `(?<!\\d)0?${month}[-./]0?${day}(?!\\d)`,
    `${m[1]}[-./]${m[2]}[-./]${m[3]}`,
  ].some((pattern) => new RegExp(pattern, "i").test(source));
}

/** True only when the date is printed together with its year, not when a print stamp merely mentions that year. */
export function yearInSource(value: string, source: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const name = m && MONTHS[Number(m[2]) - 1];
  if (!m || !name) return false;
  const month = Number(m[2]);
  const day = Number(m[3]);
  const year = `(?:${m[1]}|${m[1].slice(2)})(?!\\d)`;
  return [
    `(?<!\\d)0?${day}(?:st|nd|rd|th)?${SEPARATORS}${name}[a-z]*${SEPARATORS}${year}`,
    `${name}[a-z]*${SEPARATORS}0?${day}(?:st|nd|rd|th)?${SEPARATORS}${year}`,
    `(?<!\\d)0?${day}[-./]0?${month}[-./]${year}`,
    `(?<!\\d)0?${month}[-./]0?${day}[-./]${year}`,
    `${m[1]}[-./]${m[2]}[-./]${m[3]}`,
  ].some((pattern) => new RegExp(pattern, "i").test(source));
}

export function durationInSource(value: string, source: string): boolean {
  const numbers = value.match(/\d+/g);
  if (!numbers) return false;
  const pattern = numbers.map((n) => `0?${Number(n)}`).join("\\D{1,6}");
  return new RegExp(`(?<!\\d)${pattern}(?!\\d)`).test(source);
}

export function amountInSource(value: number, source: string): boolean {
  const plain = source.replace(/(?<=\d)[,\s'](?=\d{3}(?!\d))/g, "");
  const [whole, decimals = ""] = String(value).split(".");
  const fraction = decimals ? `[.,]${decimals}0*` : "(?:[.,]0+)?";
  return new RegExp(`(?<![\\d.,])${whole}${fraction}(?!\\d)`).test(plain);
}

export function currencyInSource(code: string, source: string): boolean {
  const upper = code.toUpperCase();
  if (/^[A-Z]{3}$/.test(upper) && new RegExp(`(?<![A-Za-z])${upper}(?![A-Za-z])`).test(source)) return true;
  return CURRENCY_SYMBOLS[upper] ? source.includes(CURRENCY_SYMBOLS[upper]) : false;
}

export const mentionsTravellers = (source: string) => /\b(adt|adults?|pax|passengers?|child(ren)?|chd|cnn|inf|infants?)\b/i.test(source);
export const mentionsStops = (source: string) => /non[\s-]?stop|\bdirect\b|\bstops?\b/i.test(source);
