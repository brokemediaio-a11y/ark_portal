import { describe, expect, it } from "vitest";
import { calculatePrice, currencyMinorDigits, formatMoney } from "./pricing";

describe("calculatePrice", () => {
  it("adds a fixed markup to the source total", () => {
    expect(calculatePrice(1000, { type: "fixed", value: 150 }, "USD")).toEqual({
      sourceTotal: 1000,
      markupAmount: 150,
      sellingTotal: 1150,
    });
  });

  it("applies a percentage markup and rounds half-up to the minor unit", () => {
    // 10.05 × 5% = 0.5025 → 0.50
    expect(calculatePrice(10.05, { type: "percentage", value: 5 }, "USD")?.markupAmount).toBe(0.5);
    // 0.10 × 5% = 0.005 → 0.01 (half-up)
    expect(calculatePrice(0.1, { type: "percentage", value: 5 }, "USD")?.markupAmount).toBe(0.01);
  });

  it("avoids floating point drift", () => {
    expect(calculatePrice(0.1, { type: "fixed", value: 0.2 }, "USD")?.sellingTotal).toBe(0.3);
  });

  it("respects zero-decimal currencies", () => {
    expect(currencyMinorDigits("JPY")).toBe(0);
    expect(calculatePrice(1001, { type: "percentage", value: 10 }, "JPY")?.sellingTotal).toBe(1101);
  });

  it("returns null when there is no source total", () => {
    expect(calculatePrice(null, { type: "fixed", value: 10 }, "USD")).toBeNull();
  });

  it("treats a missing markup value as zero", () => {
    expect(calculatePrice(500, { type: "fixed", value: Number.NaN }, "PKR")?.sellingTotal).toBe(500);
  });
});

describe("formatMoney", () => {
  it("formats with the currency", () => {
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
  });
  it("falls back gracefully for unknown currency codes", () => {
    expect(formatMoney(10, "XX")).toBe("XX 10.00");
  });
});
