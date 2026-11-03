import { describe, expect, it } from "vitest";
import { parseSearchRequest } from "./search-service";

const TODAY = "2026-11-01";
const base = {
  slices: [
    { origin: "man", destination: "KBL", departureDate: "2026-11-02" },
    { origin: "KBL", destination: "MAN", departureDate: "2026-11-12" },
  ],
  passengers: { adults: 1, childAges: [], infantAges: [] },
  cabinClass: "economy",
  maxConnections: null,
};

describe("parseSearchRequest", () => {
  it("accepts and normalizes a valid return search", () => {
    expect(parseSearchRequest(base, TODAY).slices[0].origin).toBe("MAN");
  });

  it.each([
    [{ ...base, slices: [{ origin: "KBL", destination: "KBL", departureDate: "2026-11-02" }] }, "slices.0.destination"],
    [{ ...base, slices: [{ origin: "Kabul", destination: "MAN", departureDate: "2026-11-02" }] }, "slices.0.origin"],
    [{ ...base, slices: [{ origin: "MAN", destination: "KBL", departureDate: "2026-10-31" }] }, "slices.0.departureDate"],
    [{ ...base, slices: [base.slices[0], { ...base.slices[1], departureDate: "2026-11-01" }] }, "slices.1.departureDate"],
    [{ ...base, slices: [{ origin: "MAN", destination: "KBL", departureDate: "2027-12-01" }] }, "slices.0.departureDate"],
    [{ ...base, passengers: { adults: 1, childAges: [], infantAges: [0, 1] } }, "passengers"],
    [{ ...base, passengers: { adults: 5, childAges: [4, 6, 8, 10, 12], infantAges: [] } }, "passengers"],
    [{ ...base, cabinClass: "luxury" }, "cabinClass"],
  ])("rejects invalid input on %#", (body, field) => {
    expect(() => parseSearchRequest(body, TODAY)).toThrow(expect.objectContaining({ code: "invalid_request", field }));
  });

  it("rejects a missing body", () => {
    expect(() => parseSearchRequest(null, TODAY)).toThrow(expect.objectContaining({ code: "invalid_request" }));
  });
});
