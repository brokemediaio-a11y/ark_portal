import { describe, expect, it } from "vitest";
import { orderFlightsBySource } from "./flight-order";
import { DEMO_EXTRACTION } from "./quotation-demo";
import type { Extraction } from "../schema";
import { quotationTask } from "./quotation-task";
import { ticketTask } from "@/features/ticket/server/ticket-task";
import { DEMO_TICKET } from "@/features/ticket/server/ticket-demo";

// Anonymous route-only reproduction: raw PDF object order places flight 4 before 3.
const source = `FLIGHT 1 - Amsterdam (AMS) to Doha (DOH)
FLIGHT 2 - Doha (DOH) to Kabul (KBL)
FLIGHT 3 - Kabul (KBL) to Doha (DOH)
FLIGHT 4 - Doha (DOH) to Amsterdam (AMS)`;
function data(): Extraction {
  const leg = (originCode: string, destinationCode: string, flightNumber: string, departureDate: string) => ({
    ...DEMO_EXTRACTION.segments[0], originCode, destinationCode, flightNumber, departureDate,
  });
  return { ...structuredClone(DEMO_EXTRACTION), segments: [
    leg("AMS", "DOH", "QR 274", "2026-12-12"), leg("DOH", "KBL", "RQ 978", "2026-12-13"),
    leg("DOH", "AMS", "QR 273", "2027-01-14"), leg("KBL", "DOH", "RQ 977", "2027-01-13"),
  ], uncertainFields: [{ field: "segments.2.departureTime", reason: "Check flight 4 time", evidence: null }] };
}
describe("orderFlightsBySource", () => {
  it("restores the numbered itinerary, moving complete segments and their flags together", () => {
    const result = orderFlightsBySource(data(), source);
    expect(result.segments.map(s => s.flightNumber)).toEqual(["QR 274", "RQ 978", "RQ 977", "QR 273"]);
    expect(result.segments[2]).toMatchObject({ originCode: "KBL", destinationCode: "DOH", departureDate: "2027-01-13" });
    expect(result.uncertainFields[0].field).toBe("segments.3.departureTime");
  });
  it("ignores passenger-page repeats and supports the old PDF heading text order", () => {
    const raw = source.replaceAll(/([A-Za-z]+) \(([A-Z]{3})\) to ([A-Za-z]+) \(([A-Z]{3})\)/g, "($2) ($4)$1 to $3");
    expect(orderFlightsBySource(data(), `${raw}\n${raw}\n${raw}`).segments[2].flightNumber).toBe("RQ 977");
  });
  it("keeps incomplete or ambiguous evidence for staff rather than inventing an order", () => {
    const input = data();
    expect(orderFlightsBySource(input, source.split("\n").slice(0, 3).join("\n"))).toBe(input);
    expect(orderFlightsBySource(input, `${source}\nFLIGHT 1 - Kabul (KBL) to Doha (DOH)`)).toBe(input);
    expect(orderFlightsBySource(input, source.replace("Doha (DOH) to Amsterdam (AMS)", "Amsterdam (AMS) to Doha (DOH)"))).toBe(input);
    input.segments[3].originCode = null;
    expect(orderFlightsBySource(input, source)).toBe(input);
  });
  it("leaves unnumbered sources and existing correct sequences unchanged", () => {
    const input = data();
    expect(orderFlightsBySource(input, "No numbered itinerary here")).toBe(input);
    const correct = orderFlightsBySource(input, source);
    expect(orderFlightsBySource(correct, source)).toBe(correct);
  });
  it("applies the correction through both quotation and ticket verification pipelines", () => {
    const input = data();
    const text = `${source}\nQR | 274 | 12/12/2026\nRQ | 978 | 13/12/2026\nRQ | 977 | 13/01/2027\nQR | 273 | 14/01/2027`;
    const documents = { source: text, documents: [text], reads: null, scanned: false };
    const ticket = { ...structuredClone(DEMO_TICKET), segments: input.segments.map(segment => ({ ...DEMO_TICKET.segments[0], ...segment })), uncertainFields: input.uncertainFields };
    const expected = ["QR 274", "RQ 978", "RQ 977", "QR 273"];
    expect(quotationTask.verify(input, documents, "2026-11-09").segments.map(segment => segment.flightNumber)).toEqual(expected);
    expect(ticketTask.verify(ticket, documents, "2026-11-09").segments.map(segment => segment.flightNumber)).toEqual(expected);
  });
});
