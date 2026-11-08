/**
 * Persian (Solar Hijri) dates, as printed on Iranian tickets ("1405/07/15").
 * Converted with the standard arithmetic algorithm rather than by the AI, which
 * guesses. Valid for the years printed on current documents (1300–1499).
 */

const PERSIAN_DATE = /^\s*(1[34]\d{2})[/.-](\d{1,2})[/.-](\d{1,2})\s*$/;

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** 1405, 7, 15 → "2026-10-07". */
export function persianToIso(jy: number, jm: number, jd: number): string | null {
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31 || (jm > 6 && jd > 30)) return null;
  const y = jy + 1595;
  let days = -355668 + 365 * y + Math.floor(y / 33) * 8 + Math.floor(((y % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const monthDays = [31, isLeap(gy) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 12 && gd > monthDays[gm]) gd -= monthDays[gm++];
  return `${gy}-${String(gm + 1).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
}

/** A printed Persian date → ISO date, or null when the text isn't one. */
export function parsePersianDate(text: string | null): string | null {
  const m = text ? PERSIAN_DATE.exec(text) : null;
  return m ? persianToIso(Number(m[1]), Number(m[2]), Number(m[3])) : null;
}
