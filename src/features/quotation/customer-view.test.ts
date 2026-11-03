import { describe, expect, it } from "vitest";
import { buildCustomerQuote, buildShareMessage, formatIsoDate } from "./customer-view";
import { createEmptyQuotation } from "./factory";

function quotation() {
  const q = createEmptyQuotation();
  q.segments[0] = { ...q.segments[0], originCode: "LHE", destinationCode: "DXB", departureDate: "2026-12-10" };
  q.currency = "USD";
  q.sourceTotal = 987.65;
  q.markup = { type: "fixed", value: 112.35 };
  q.passengers = { adults: 2, children: 1, infants: null };
  return q;
}

describe("buildCustomerQuote", () => {
  it("shows only the selling price — never supplier cost or markup", () => {
    const view = buildCustomerQuote(quotation());
    const serialized = JSON.stringify(view) + buildShareMessage(view);
    expect(view.totalPrice).toBe("$1,100.00");
    expect(serialized).not.toContain("987.65");
    expect(serialized).not.toContain("112.35");
  });

  it("summarises route and travellers", () => {
    const view = buildCustomerQuote(quotation());
    expect(view.routeSummary).toBe("LHE – DXB");
    expect(view.travellers).toBe("2 adults, 1 child");
  });

  it("marks demo quotations and test-mode fares", () => {
    const q = quotation();
    expect(buildCustomerQuote(q).watermark).toBeNull();
    q.providerSnapshot = { provider: "duffel", offerRequestId: "orq_1", offerId: "off_1", liveMode: false, totalAmount: 1, totalCurrency: "EUR", expiresAt: null, refreshedAt: "2026-11-01T00:00:00Z" };
    expect(buildCustomerQuote(q).watermark).toBe("TEST MODE — NOT A REAL FARE");
    q.sourceType = "demo";
    expect(buildCustomerQuote(q).watermark).toBe("DEMO DATA — NOT A REAL QUOTATION");
  });
});

describe("formatIsoDate", () => {
  it("formats without timezone shifts", () => {
    expect(formatIsoDate("2026-12-10")).toBe("Thu, 10 Dec 2026");
  });
  it("passes through unrecognised values", () => {
    expect(formatIsoDate(null)).toBeNull();
  });
});
