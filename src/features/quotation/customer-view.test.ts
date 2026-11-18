import { describe, expect, it } from "vitest";
import { buildCustomerQuote, buildShareMessage, formatIsoDate } from "./customer-view";
import { createEmptyQuotation } from "./factory";
import { reviewQuotation } from "./review";

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
    expect(view.prices[0]).toMatchObject({ label: "Adults", amount: "$1,100.00" });
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

describe("children and infants", () => {
  function family() {
    const q = quotation();
    q.passengers = { adults: 2, children: 1, infants: 1 };
    q.youngPricing = { sourceTotal: 400, markup: { type: "percentage", value: 10 } };
    q.childNames = ["Ali Khan"];
    q.infantNames = ["Sara Khan"];
    return q;
  }

  it("prints one bar for the adults and one for the children and infants, with their names", () => {
    const view = buildCustomerQuote(family());
    expect(view.prices).toEqual([
      { label: "Adults", detail: "2 adults", names: [], amount: "$1,100.00" },
      { label: "Children & infants", detail: "1 child, 1 infant", names: ["Ali Khan (child)", "Sara Khan (infant)"], amount: "$440.00" },
    ]);
    // The supplier prices and markups stay internal.
    const serialized = JSON.stringify(view) + buildShareMessage(view);
    for (const internal of ["987.65", "112.35", "400"]) expect(serialized).not.toContain(internal);
    expect(buildShareMessage(view)).toContain("Price for children & infants (Ali Khan (child), Sara Khan (infant)): $440.00");
  });

  it("keeps a single total when everyone is an adult", () => {
    const q = quotation();
    q.passengers = { adults: 2, children: 0, infants: null };
    expect(buildCustomerQuote(q).prices).toEqual([{ label: "Total price", detail: null, names: [], amount: "$1,100.00" }]);
  });

  it("asks for the children/infants price and warns about a missing name", () => {
    const q = family();
    q.youngPricing = { sourceTotal: null, markup: { type: "fixed", value: 0 } };
    q.infantNames = [];
    const issues = reviewQuotation(q, "2026-11-01");
    expect(issues.find((i) => i.field === "youngPricing.sourceTotal")?.level).toBe("blocking");
    expect(issues.find((i) => i.field === "childNames")?.message).toBe("Name missing for Infant 1.");
  });
});
