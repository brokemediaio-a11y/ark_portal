import { createCanvas } from "@napi-rs/canvas";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { beforeAll, describe, expect, it } from "vitest";
import { extractDocuments } from "@/features/extraction/server/extract-service";
import { orderFlightsAcrossDocuments } from "@/features/extraction/server/flight-order";
import { airlineNamedBefore, groundSegment, isTicketProviderName, splitTrailingCode } from "@/features/extraction/server/grounding";
import { dropFlagsOnEmptyValues } from "@/features/extraction/server/verification";
import { normalizeDocumentText } from "@/features/extraction/server/normalize-text";
import type { ExtractionProvider } from "@/features/extraction/server/providers/types";
import { timeInSource } from "@/features/extraction/server/source-match";
import type { TicketExtraction } from "./extraction-schema";
import { DEMO_TICKET } from "./server/ticket-demo";
import { ticketFromExtraction } from "./factory";
import { labelledReference, mergeTravellers, ticketTask, travellerKey } from "./server/ticket-task";
import { buildCustomerTicket } from "./ticket-view";

/*
 * One trip booked through two suppliers (made-up traveller): an e-itinerary holding the outbound and return flights,
 * whose times are printed with the ratio sign "∶" instead of a colon, and two charter tickets for the flights in
 * between, one file each.
 */
const ITINERARY = `Itinerary
Booking No. 1234567890123456
Name | Class | E-ticket No. | Airline Booking Reference
JANE (First name) DOE (Last name) | Economy | 235-1111111111 | ABCDEF
Flight Information
Gothenburg - Istanbul
Departure | 18∶15, November 17, 2026, Goteborg Landvetter Airport
Arrival | 23∶45, November 17, 2026, Istanbul Airport
Airline | Turkish Airlines TK1800
Istanbul - Gothenburg
Departure | 15∶45, November 26, 2026, Istanbul Airport
Arrival | 17∶20, November 26, 2026, Goteborg Landvetter Airport
Airline | Turkish Airlines TK1799`;
const charter = (flight: string, ticket: string, pnr: string, from: string, to: string, date: string, dep: string, arr: string) => `FLIGHT TICKET
FLIGHT No : ${flight} | TICKET No : ${ticket} | PNR : ${pnr}
FROM : ${from} | TO : ${to}
DEPARTURE : ${date} | ${dep}
ARRIVAL : ${date} | ${arr}
PASSENGER : Doe / Jane MR
MAX BAG : 25KG | Economy`;
const OUTBOUND_CHARTER = charter("JI4868", "6480000000001", "PTX01", "ISTANBUL IST IST", "ISFAHAN IFN IFN", "18 November 2026", "11:30 AM", "03:00 PM");
const RETURN_CHARTER = charter("JI4869", "6480000000002", "PTX02", "ISFAHAN IFN IFN", "ISTANBUL IST IST", "26 November 2026", "07:15 AM", "10:00 AM");

const leg = (flightNumber: string, originName: string, originCode: string | null, destinationName: string, destinationCode: string | null, date: string, departureTime: string, arrivalTime: string) => ({
  ...DEMO_TICKET.segments[0],
  airlineName: null, airlineCode: null, flightNumber, originName, originCode, destinationName, destinationCode,
  departureDate: date, arrivalDate: date, departureTime, arrivalTime, departureTerminal: null, bookingClass: null, bookingStatus: null,
  handCarry: null, checkIn: "25KG", bookingReference: null,
});
const passenger = (name: string, ticketNumber: string, flightNumbers: string[] = []) => ({ name, type: null as string | null, dateOfBirth: null as string | null, tickets: [{ ticketNumber, flightNumbers }] });
const ticket = (segments: TicketExtraction["segments"], passengers: TicketExtraction["passengers"], bookingReference: string): TicketExtraction => ({
  ...structuredClone(DEMO_TICKET), issueDate: null, issueDateAsPrinted: null, issuedBy: null, bookingReference, passengers, segments, uncertainFields: [],
});

const JI4868 = leg("JI4868", "ISTANBUL IST", "IST", "ISFAHAN", "IFN", "2026-11-18", "11:30", "15:00");
const JI4869 = leg("JI4869", "ISFAHAN", "IFN", "ISTANBUL", "IST", "2026-11-26", "07:15", "10:00");
const TK1800 = leg("TK1800", "Goteborg Landvetter Airport", null, "Istanbul Airport", null, "2026-11-17", "18:15", "23:45");
const TK1799 = leg("TK1799", "Istanbul Airport", null, "Goteborg Landvetter Airport", null, "2026-11-26", "15:45", "17:20");

/** Answers like the AI did: given all three files it leaves out the e-itinerary; given that file alone it reads it. */
function forgetfulProvider() {
  const calls: string[] = [];
  const provider: ExtractionProvider = {
    name: "fake",
    isDemo: false,
    // The e-itinerary comes in as a scan; both readings copy its look-alike colons.
    transcribe: async () => ITINERARY,
    async extract(text) {
      calls.push(text);
      if (text.includes("<document_1")) return ticket([JI4868, JI4869], [passenger("Doe / Jane MR", "6480000000001"), passenger("Doe / Jane MR", "6480000000002")], "PTX01");
      return ticket([TK1800, TK1799], [passenger("JANE DOE", "235-1111111111")], "ABCDEF");
    },
  };
  return { provider, calls };
}

/** A scan of the e-itinerary: no font at hand prints "∶", so its text arrives as the readings of an image. */
function scan() {
  const canvas = createCanvas(400, 200);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 400, 200);
  ctx.fillStyle = "#000";
  ctx.fillRect(20, 40, 300, 20);
  return new Uint8Array(canvas.toBuffer("image/png"));
}

async function pdf(text: string) {
  return new Uint8Array(await renderToBuffer(<Document><Page><Text>{text}</Text></Page></Document>));
}

let files: { name: string; bytes: Uint8Array }[];
beforeAll(async () => {
  files = [
    { name: "Charter 1.pdf", bytes: await pdf(OUTBOUND_CHARTER) },
    { name: "E-itinerary.png", bytes: scan() },
    { name: "Charter 2.pdf", bytes: await pdf(RETURN_CHARTER) },
  ];
});

describe("a trip split across several supplier files", () => {
  it("reads times printed with a look-alike colon", () => {
    expect(timeInSource("18:15", ITINERARY)).toBe(false);
    const text = normalizeDocumentText(ITINERARY);
    expect(text).toContain("Departure | 18:15, November 17, 2026");
    for (const time of ["18:15", "23:45", "15:45", "17:20"]) expect(timeInSource(time, text), time).toBe(true);
    expect(normalizeDocumentText("6:30 PM – ２３：４５")).toBe("6:30 PM - 23:45");
  });

  it("re-reads a file the AI left out, keeps every printed time, and puts all flights in travel order", async () => {
    const { provider, calls } = forgetfulProvider();
    const { data } = await extractDocuments(files, provider, ticketTask);

    // The combined read, then the e-itinerary again on its own.
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain('name="E-itinerary.png"');
    expect(calls[1]).not.toContain("JI4868");

    expect(data.segments.map((s) => [s.flightNumber, s.departureDate, s.departureTime, s.arrivalTime])).toEqual([
      ["TK1800", "2026-11-17", "18:15", "23:45"],
      ["JI4868", "2026-11-18", "11:30", "15:00"],
      ["JI4869", "2026-11-26", "07:15", "10:00"],
      ["TK1799", "2026-11-26", "15:45", "17:20"],
    ]);
    // Each flight has the booking reference printed in its own file.
    expect(data.segments.map((s) => s.bookingReference)).toEqual(["ABCDEF", "PTX01", "PTX02", "ABCDEF"]);
    // One traveller, with each file's e-ticket number covering that file's flights.
    expect(data.passengers).toEqual([{ name: "Doe / Jane MR", type: null, dateOfBirth: null, tickets: [
      { ticketNumber: "6480000000001", flightNumbers: ["JI4868"] },
      { ticketNumber: "6480000000002", flightNumbers: ["JI4869"] },
      { ticketNumber: "235-1111111111", flightNumbers: ["TK1800", "TK1799"] },
    ] }]);

    // The e-ticket names every booking and which ticket is for which flight.
    const view = buildCustomerTicket(ticketFromExtraction(data, { fileNames: [], demo: false }));
    const covered = (items: { value: string; flights: { title: string }[] }[]) => items.map((i) => [i.value, i.flights.map((f) => f.title)]);
    expect(view.bookingReference).toBeNull();
    expect(covered(view.bookings)).toEqual([["ABCDEF", ["Flight 1", "Flight 4"]], ["PTX01", ["Flight 2"]], ["PTX02", ["Flight 3"]]]);
    expect(covered(view.passengers[0].tickets)).toEqual([["235-1111111111", ["Flight 1", "Flight 4"]], ["6480000000001", ["Flight 2"]], ["6480000000002", ["Flight 3"]]]);
    expect(view.issuedBy).toBe("Ark Travelers AB");
    expect(data.uncertainFields.filter((f) => /Time$/.test(f.field))).toEqual([]);
    expect(data.segments[1]).toMatchObject({ originName: "ISTANBUL", originCode: "IST" });
  });

  it("makes no extra call when every file's flights and ticket numbers came back", async () => {
    const calls: string[] = [];
    const provider: ExtractionProvider = {
      name: "fake", isDemo: false, transcribe: async () => ITINERARY,
      async extract(text) {
        calls.push(text);
        return ticket([JI4868, TK1800, JI4869, TK1799], [passenger("Doe / Jane MR", "6480000000001"), passenger("Doe / Jane MR", "6480000000002"), passenger("JANE DOE", "235-1111111111")], "PTX01");
      },
    };
    const { data } = await extractDocuments(files, provider, ticketTask);
    expect(calls).toHaveLength(1);
    expect(data.segments.map((s) => s.flightNumber)).toEqual(["TK1800", "JI4868", "JI4869", "TK1799"]);
  });
});

describe("orderFlightsAcrossDocuments", () => {
  const source = "<document_1>a</document_1>\n<document_2>b</document_2>";
  const data = (segments: TicketExtraction["segments"]) => ({ segments, uncertainFields: [{ field: "segments.0.arrivalTime", reason: "check", evidence: null }] });

  it("orders by date, and on one day puts the connecting flight second, moving flags along", () => {
    const result = orderFlightsAcrossDocuments(data([TK1799, JI4868, JI4869, TK1800]), source);
    expect(result.segments.map((s) => s.flightNumber)).toEqual(["TK1800", "JI4868", "JI4869", "TK1799"]);
    expect(result.uncertainFields[0].field).toBe("segments.3.arrivalTime");
  });

  it("leaves a single file, or flights without dates, in the AI's order", () => {
    expect(orderFlightsAcrossDocuments(data([TK1799, TK1800]), "one file").segments.map((s) => s.flightNumber)).toEqual(["TK1799", "TK1800"]);
    const undated = { ...TK1800, departureDate: null };
    expect(orderFlightsAcrossDocuments(data([TK1799, undated]), source).segments.map((s) => s.flightNumber)).toEqual(["TK1799", "TK1800"]);
  });
});

describe("splitTrailingCode", () => {
  it("moves a code printed after the name into the code", () => {
    expect(splitTrailingCode("ISTANBUL IST", "IST", "")).toEqual({ name: "ISTANBUL", code: "IST" });
    expect(splitTrailingCode("ISFAHAN IFN", null, "TO : ISFAHAN IFN IFN")).toEqual({ name: "ISFAHAN", code: "IFN" });
    expect(splitTrailingCode("Kabul (KBL)", null, "")).toEqual({ name: "Kabul", code: "KBL" });
  });
  it("keeps names whose last word may not be a code, and never overrides a different code", () => {
    expect(splitTrailingCode("LA PAZ", null, "LA PAZ")).toEqual({ name: "LA PAZ", code: null });
    expect(splitTrailingCode("ISTANBUL SAW", "IST", "")).toEqual({ name: "ISTANBUL SAW", code: "IST" });
    expect(splitTrailingCode("Goteborg Landvetter Airport", null, "")).toEqual({ name: "Goteborg Landvetter Airport", code: null });
  });
});

describe("mergeTravellers", () => {
  it("recognises one traveller however each supplier prints the name", () => {
    expect(travellerKey("Samadi / Kazem MR")).toBe(travellerKey("KAZEM SAMADI"));
    expect(travellerKey("KAZEM (First name) SAMADI (Last name)")).toBe(travellerKey("SAMADI/KAZEM"));
    expect(travellerKey("SAMADI/KAZEM")).not.toBe(travellerKey("SAMADI/LEILA"));
  });

  it("shows a traveller once with all their ticket numbers, keeping flags on the merged row", () => {
    const data = ticket([TK1800], [
      passenger("NOORI / FARHAD", "111"), passenger("Doe / Jane MR", "222"), passenger("JANE DOE", "333"), passenger("JANE DOE", "333"),
    ], "X");
    const merged = mergeTravellers({ ...data, uncertainFields: [{ field: "passengers.2.tickets.0.ticketNumber", reason: "check", evidence: null }] });
    expect(merged.passengers.map((p) => [p.name, p.tickets.map((t) => t.ticketNumber)])).toEqual([["NOORI / FARHAD", ["111"]], ["Doe / Jane MR", ["222", "333"]]]);
    expect(merged.uncertainFields.map((f) => f.field)).toEqual(["passengers.1.tickets"]);
  });

  it("keeps people with the same name apart when their date of birth or type differs", () => {
    const data = ticket([TK1800], [
      { ...passenger("DOE/JANE", "111"), dateOfBirth: "1990-01-01" }, { ...passenger("JANE DOE", "222"), dateOfBirth: "2015-05-05" },
      { ...passenger("DOE/SAM", "333"), type: "adult" }, { ...passenger("SAM DOE", "444"), type: "child" },
    ], "X");
    expect(mergeTravellers(data).passengers).toHaveLength(4);
  });
});

describe("labelledReference", () => {
  it("reads the one booking reference a file prints beside a label", () => {
    expect(labelledReference(OUTBOUND_CHARTER)).toBe("PTX01");
    expect(labelledReference("Booking reference: ABC123")).toBe("ABC123");
    // A long order number is not a booking reference; two different codes leave it to staff.
    expect(labelledReference("Booking No. 1234567890123456")).toBeNull();
    expect(labelledReference("PNR : AAAAA1 ... PNR : BBBBB2")).toBeNull();
  });
});

describe("airline and baggage rules", () => {
  it("never takes a ticket provider for the airline, and reads the airline printed before the flight number", () => {
    expect(isTicketProviderName("OrientTrips")).toBe(true);
    expect(isTicketProviderName("Trip.com")).toBe(true);
    expect(isTicketProviderName("Iran Airtour Airlines")).toBe(false);
    expect(isTicketProviderName("Emirates")).toBe(false);
    expect(airlineNamedBefore("TK", "1800", "Airline | Turkish Airlines TK1800")).toBe("Turkish Airlines");
    expect(airlineNamedBefore("JI", "4868", "FLIGHT No : JI4868 | TICKET No")).toBeNull();
  });

  it("keeps a personal item and a carry-on together when both are printed", () => {
    const source = "Personal item 1 piece per person, 4 kg each | Carry-on baggage 1 piece per person, 8 kg each | Checked baggage 23 kg per person";
    const flags: never[] = [];
    const kept = groundSegment({ ...TK1800, handCarry: "4 kg + 8 kg", checkIn: "23 kg" }, 0, `${source} TK1800 18:15 23:45 November 17`, flags);
    expect(kept).toMatchObject({ handCarry: "4 kg + 8 kg", checkIn: "23 kg" });
    expect(groundSegment({ ...TK1800, handCarry: "4 kg + 7 kg" }, 0, source, flags).handCarry).toBeNull();
  });

  it("drops the AI's own flag on a flight value it left empty, but keeps one on a value it filled", () => {
    const data = ticket([{ ...TK1800, originCode: null }], [], "X");
    const flagged = { ...data, uncertainFields: [
      { field: "segments.0.originCode", reason: "The document does not state the IATA code.", evidence: null },
      { field: "segments.0.departureDate", reason: "Year assumed.", evidence: null },
      { field: "totalAmount", reason: "Two totals printed.", evidence: null },
    ] };
    expect(dropFlagsOnEmptyValues(flagged).uncertainFields.map((f) => f.field)).toEqual(["segments.0.departureDate", "totalAmount"]);
  });
});
