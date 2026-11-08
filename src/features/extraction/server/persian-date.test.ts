import { describe, expect, it } from "vitest";
import { parsePersianDate, persianToIso } from "./persian-date";

/** Independent check: the browser/Node calendar formats an ISO date in the Persian calendar. */
const asPersian = (iso: string) =>
  new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" })
    .formatToParts(new Date(`${iso}T00:00:00Z`))
    .filter((p) => p.type !== "literal" && p.type !== "era")
    .map((p) => Number(p.value));

describe("persian dates", () => {
  it("converts the dates on the sample Iran Airtour ticket", () => {
    expect(parsePersianDate("1405/07/15")).toBe("2026-10-07");
    expect(parsePersianDate("1406/01/16")).toBe("2027-04-05");
  });

  it("agrees with the built-in Persian calendar across years and month lengths", () => {
    for (const [y, m, d] of [[1399, 12, 30], [1400, 1, 1], [1403, 12, 30], [1405, 6, 31], [1405, 7, 1], [1410, 11, 15]]) {
      const iso = persianToIso(y, m, d)!;
      const [month, day, year] = asPersian(iso);
      expect([year, month, day]).toEqual([y, m, d]);
    }
  });

  it("ignores text that isn't a Persian date", () => {
    expect(parsePersianDate("17 Sep 26")).toBeNull();
    expect(parsePersianDate("2026/10/07")).toBeNull();
    expect(parsePersianDate("1405/13/01")).toBeNull();
    expect(parsePersianDate(null)).toBeNull();
  });
});
