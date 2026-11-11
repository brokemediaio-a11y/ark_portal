import { createCanvas } from "@napi-rs/canvas";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ticketTask } from "@/features/ticket/server/ticket-task";
import type { TicketExtraction } from "@/features/ticket/extraction-schema";
import type { Extraction } from "../schema";
import { extractDocuments } from "./extract-service";
import { mockExtractionProvider } from "./providers/mock";
import { ExtractionError, type DocumentImage, type ExtractionProvider } from "./providers/types";
import { DEMO_EXTRACTION } from "./quotation-demo";
import { quotationTask } from "./quotation-task";

/** A real, decodable image with some dark rows, as the page slicer needs. */
function makePng() {
  const canvas = createCanvas(400, 200);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 400, 200);
  ctx.fillStyle = "#000";
  ctx.fillRect(20, 40, 300, 20);
  return new Uint8Array(canvas.toBuffer("image/png"));
}
const PNG = makePng();
const SIGNATURE_ONLY_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(1)]);

async function makePdf(text: string) {
  return new Uint8Array(
    await renderToBuffer(
      <Document>
        <Page>
          <Text>{text}</Text>
        </Page>
      </Document>,
    ),
  );
}

/** A provider that records its calls and returns fixed responses; transcripts are handed out in order. */
function fakeProvider(response: unknown | (() => never), transcripts: string[] = ["read one", "read two"]) {
  const calls = { extract: [] as string[], transcribe: [] as DocumentImage[][] };
  const provider: ExtractionProvider & { calls: typeof calls } = {
    name: "fake",
    isDemo: false,
    calls,
    async transcribe(images) {
      calls.transcribe.push(images);
      return transcripts[calls.transcribe.length - 1] ?? "";
    },
    async extract(text) {
      calls.extract.push(text);
      return typeof response === "function" ? (response as () => never)() : structuredClone(response);
    },
  };
  return provider;
}

const file = (name: string, bytes: Uint8Array) => ({ name, bytes });
let textPdf: Uint8Array;
let scannedPdf: Uint8Array;

beforeAll(async () => {
  textPdf = await makePdf(
    "Flight EK 623 Lahore (LHE) to Dubai (DXB) departing 10 December 2026 at 04:15, arriving 06:45. Total fare PKR 185,000 for 2 adults. Baggage 30kg.",
  );
  scannedPdf = await makePdf(" ");
});

describe("extractDocuments (quotations)", () => {
  it("uses the PDF text layer when present, without reading images", async () => {
    const provider = fakeProvider(DEMO_EXTRACTION);
    const result = await extractDocuments([file("quote.pdf", textPdf)], provider, quotationTask);
    expect(provider.calls.transcribe).toHaveLength(0);
    expect(provider.calls.extract[0]).toContain("EK 623");
    expect(result.method).toBe("pdf-text");
  });

  it("reads scanned PDFs and images twice, and structures both readings", async () => {
    for (const [name, bytes] of [["scan.pdf", scannedPdf], ["shot.png", PNG]] as const) {
      const provider = fakeProvider(DEMO_EXTRACTION);
      const result = await extractDocuments([file(name, bytes)], provider, quotationTask);
      expect(provider.calls.transcribe).toHaveLength(2);
      expect(provider.calls.transcribe[0][0].mimeType).toBe("image/png");
      expect(provider.calls.extract[0]).toContain("<reading_1>\nread one\n</reading_1>");
      expect(provider.calls.extract[0]).toContain("<reading_2>\nread two\n</reading_2>");
      expect(result.method).toBe("vision");
    }
  });

  it("reads several files together as labelled documents of one job", async () => {
    const provider = fakeProvider(DEMO_EXTRACTION, ["scan one", "scan two"]);
    await extractDocuments([file("outbound.pdf", textPdf), file("return <x>.png", PNG)], provider, quotationTask);
    const text = provider.calls.extract[0];
    expect(provider.calls.extract).toHaveLength(1);
    expect(text).toContain('<document_1 name="outbound.pdf">');
    expect(text).toContain("EK 623");
    expect(text).toContain('<document_2 name="return x.png">');
    expect(text).toContain("<reading_1>\nscan one\n</reading_1>");
  });

  it("names the file that can't be read", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const provider = fakeProvider(DEMO_EXTRACTION);
    const error = await extractDocuments([file("good.pdf", textPdf), file("bad.png", SIGNATURE_ONLY_PNG)], provider, quotationTask).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "invalid_file" });
    expect((error as Error).message).toContain("bad.png");
    expect(provider.calls.extract).toHaveLength(0);
    spy.mockRestore();
  });

  it("strips code fences from a transcript", async () => {
    const provider = fakeProvider(DEMO_EXTRACTION, ["```\nTK 1954\n```", "TK 1954"]);
    await extractDocuments([file("shot.png", PNG)], provider, quotationTask);
    expect(provider.calls.extract[0]).toContain("<reading_1>\nTK 1954\n</reading_1>");
  });

  it("removes values neither reading supports", async () => {
    const provider = fakeProvider(DEMO_EXTRACTION, ["unrelated text", "unrelated text"]);
    const { data } = await extractDocuments([file("shot.png", PNG)], provider, quotationTask);
    expect(data.segments[0]).toMatchObject({ flightNumber: null, departureTime: null, checkIn: null });
    expect(data.totalAmount).toBeNull();
    expect(data.uncertainFields.map((f) => f.field)).toContain("segments.0.flightNumber");
  });

  it("reports images without any text, before structuring", async () => {
    const provider = fakeProvider(DEMO_EXTRACTION, ["", ""]);
    await expect(extractDocuments([file("shot.png", PNG)], provider, quotationTask)).rejects.toMatchObject({ code: "no_flight_details" });
    expect(provider.calls.extract).toHaveLength(0);
  });

  it("keeps demo data as is, without reading images", async () => {
    const result = await extractDocuments([file("shot.png", PNG)], mockExtractionProvider, quotationTask);
    expect(result).toMatchObject({ method: "demo", demo: true });
    expect(result.data.segments[0].flightNumber).toBe("DA 101");
  });

  it("rejects invalid files before calling the AI", async () => {
    const provider = fakeProvider(DEMO_EXTRACTION);
    await expect(extractDocuments([file("quote.pdf", PNG)], provider, quotationTask)).rejects.toMatchObject({ code: "invalid_file" });
    expect(provider.calls.extract).toHaveLength(0);
  });

  it("rejects AI output that doesn't match the schema", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const provider = fakeProvider({ segments: "not an array" });
    await expect(extractDocuments([file("quote.pdf", textPdf)], provider, quotationTask)).rejects.toMatchObject({ code: "ai_failed" });
    spy.mockRestore();
  });

  it("reports documents without flight details", async () => {
    const provider = fakeProvider({ ...DEMO_EXTRACTION, documentHasFlightDetails: false, segments: [] } satisfies Extraction);
    await expect(extractDocuments([file("quote.pdf", textPdf)], provider, quotationTask)).rejects.toMatchObject({ code: "no_flight_details" });
  });

  it("turns provider failures into safe errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const provider = fakeProvider(() => {
      throw new Error("secret upstream detail sk-123");
    });
    const error = await extractDocuments([file("quote.pdf", textPdf)], provider, quotationTask).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ExtractionError);
    expect(error).toMatchObject({ code: "ai_failed" });
    expect((error as Error).message).not.toContain("sk-123");
    spy.mockRestore();
  });
});

/** The text of the real Iran Airtour ticket (Persian issue date, one passenger). */
const TAHIRI = `Ticket Number | Ticket Issuance Date | Ticket Expiry Date | Confirmation / .Booking ref
4911013760658 | 1405/07/15 | 1406/01/16 | 4S2JX
Passenger Name : TAHIRI / QODRATULLAH MR.
FROM: Mashhad | TO: Istanbul (IST) | FLIGHT DATE : 18 Oct 2026 | SUNDAY | DEPARTURE 08:00 Arrival 11:30
Flight Number B9-9735 | Baggage Allowance 30 kg | Economy Flight Class`;

const tahiriAnswer = (over: Partial<TicketExtraction> = {}): TicketExtraction => ({
  documentHasTicketDetails: true,
  bookingReference: "4S2JX",
  airlineReference: null,
  issueDate: "2026-10-18",
  issueDateAsPrinted: "1405/07/15",
  issuedBy: null,
  passengers: [
    { name: "TAHIRI / QODRATULLAH MR.", type: null, dateOfBirth: null, ticketNumber: "4911013760658" },
    { name: "TAHIRI / QODRATULLAH MR.", type: null, dateOfBirth: null, ticketNumber: "4911013760658" },
  ],
  segments: [
    {
      airlineName: null, airlineCode: null, flightNumber: "B9-9735", originCode: "MHD", originName: "Mashhad", destinationCode: "IST",
      destinationName: "Istanbul", departureDate: "2026-10-18", departureTime: "08:00", arrivalDate: "2026-10-18", arrivalTime: "11:30",
      duration: null, stops: null, cabin: "Y", handCarry: null, checkIn: "30 kg", departureTerminal: null, arrivalTerminal: null, bookingClass: "Y", bookingStatus: null,
    },
  ],
  fareConditions: null,
  uncertainFields: [],
  ...over,
});

describe("extractDocuments (tickets)", () => {
  it("converts the Persian issue date in code and keeps every passenger once", async () => {
    const { data } = await extractDocuments([file("ticket.png", PNG)], fakeProvider(tahiriAnswer(), [TAHIRI, TAHIRI]), ticketTask);
    expect(data.issueDate).toBe("2026-10-07");
    expect(data.passengers).toHaveLength(1);
    expect(data.passengers[0]).toMatchObject({ name: "TAHIRI / QODRATULLAH MR.", ticketNumber: "4911013760658" });
  });

  it("drops an airport code that isn't printed, quietly when the name is, and a class letter given as the cabin", async () => {
    const { data } = await extractDocuments([file("ticket.png", PNG)], fakeProvider(tahiriAnswer(), [TAHIRI, TAHIRI]), ticketTask);
    expect(data.segments[0]).toMatchObject({ originCode: null, originName: "Mashhad", destinationCode: "IST", cabin: null, bookingClass: "Y" });
    expect(data.uncertainFields.map((f) => f.field)).not.toContain("segments.0.originCode");
  });

  it("removes a ticket number that isn't printed, and flags one a reading contradicts", async () => {
    const answer = tahiriAnswer({ passengers: [{ name: "TAHIRI / QODRATULLAH MR.", type: null, dateOfBirth: null, ticketNumber: "4911013760659" }] });
    const removed = await extractDocuments([file("ticket.png", PNG)], fakeProvider(answer, [TAHIRI, TAHIRI]), ticketTask);
    expect(removed.data.passengers[0].ticketNumber).toBeNull();
    expect(removed.data.uncertainFields.map((f) => f.field)).toContain("passengers.0.ticketNumber");

    const misread = TAHIRI.replace("4911013760658", "4911013760668");
    const flagged = await extractDocuments([file("ticket.png", PNG)], fakeProvider(tahiriAnswer(), [TAHIRI, misread]), ticketTask);
    expect(flagged.data.passengers[0].ticketNumber).toBe("4911013760658");
    expect(flagged.data.uncertainFields.map((f) => f.field)).toContain("passengers.0.ticketNumber");
  });
});
