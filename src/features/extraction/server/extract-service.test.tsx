import { createCanvas } from "@napi-rs/canvas";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { extractQuotation } from "./extract-service";
import { mockExtractionProvider } from "./providers/mock";
import { ExtractionError, type DocumentImage, type ExtractionProvider } from "./providers/types";

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

/** A provider that records its calls and returns fixed responses. */
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

let demoData: unknown;
let textPdf: Uint8Array;
let scannedPdf: Uint8Array;

beforeAll(async () => {
  demoData = await mockExtractionProvider.extract("", new AbortController().signal);
  textPdf = await makePdf(
    "Flight EK 623 Lahore (LHE) to Dubai (DXB) departing 10 December 2026 at 04:15, arriving 06:45. Total fare PKR 185,000 for 2 adults. Baggage 30kg.",
  );
  scannedPdf = await makePdf(" ");
});

describe("extractQuotation", () => {
  it("uses the PDF text layer when present, without reading images", async () => {
    const provider = fakeProvider(demoData);
    const result = await extractQuotation("quote.pdf", textPdf, provider);
    expect(provider.calls.transcribe).toHaveLength(0);
    expect(provider.calls.extract[0]).toContain("EK 623");
    expect(result.method).toBe("pdf-text");
  });

  it("reads scanned PDFs and images twice, and structures both readings", async () => {
    for (const [name, bytes] of [["scan.pdf", scannedPdf], ["shot.png", PNG]] as const) {
      const provider = fakeProvider(demoData);
      const result = await extractQuotation(name, bytes, provider);
      expect(provider.calls.transcribe).toHaveLength(2);
      expect(provider.calls.transcribe[0][0].mimeType).toBe("image/png");
      expect(provider.calls.extract[0]).toContain("<reading_1>\nread one\n</reading_1>");
      expect(provider.calls.extract[0]).toContain("<reading_2>\nread two\n</reading_2>");
      expect(result.method).toBe("vision");
    }
  });

  it("strips code fences from a transcript", async () => {
    const provider = fakeProvider(demoData, ["```\nTK 1954\n```", "TK 1954"]);
    await extractQuotation("shot.png", PNG, provider);
    expect(provider.calls.extract[0]).toContain("<reading_1>\nTK 1954\n</reading_1>");
  });

  it("removes values neither reading supports", async () => {
    const provider = fakeProvider(demoData, ["unrelated text", "unrelated text"]);
    const { data } = await extractQuotation("shot.png", PNG, provider);
    expect(data.segments[0]).toMatchObject({ flightNumber: null, departureTime: null, baggage: null });
    expect(data.totalAmount).toBeNull();
    expect(data.uncertainFields.map((f) => f.field)).toContain("segments.0.flightNumber");
  });

  it("reports an image that has no text", async () => {
    const provider = fakeProvider(demoData, ["", ""]);
    await expect(extractQuotation("shot.png", PNG, provider)).rejects.toMatchObject({ code: "no_flight_details" });
    expect(provider.calls.extract).toHaveLength(0);
  });

  it("rejects a corrupt image before calling the AI", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const provider = fakeProvider(demoData);
    await expect(extractQuotation("shot.png", SIGNATURE_ONLY_PNG, provider)).rejects.toMatchObject({ code: "invalid_file" });
    expect(provider.calls.transcribe).toHaveLength(0);
    spy.mockRestore();
  });

  it("keeps demo data as is, without reading images", async () => {
    const result = await extractQuotation("shot.png", PNG, mockExtractionProvider);
    expect(result).toMatchObject({ method: "demo", demo: true });
    expect(result.data.segments[0].flightNumber).toBe("DA 101");
  });

  it("rejects invalid files before calling the AI", async () => {
    const provider = fakeProvider(demoData);
    await expect(extractQuotation("quote.pdf", PNG, provider)).rejects.toMatchObject({ code: "invalid_file" });
    expect(provider.calls.extract).toHaveLength(0);
    expect(provider.calls.transcribe).toHaveLength(0);
  });

  it("rejects AI output that doesn't match the schema", async () => {
    const provider = fakeProvider({ segments: "not an array" });
    await expect(extractQuotation("shot.png", PNG, provider)).rejects.toMatchObject({ code: "ai_failed" });
  });

  it("reports documents without flight details", async () => {
    const provider = fakeProvider({ ...(demoData as object), documentHasFlightDetails: false, segments: [] });
    await expect(extractQuotation("shot.png", PNG, provider)).rejects.toMatchObject({ code: "no_flight_details" });
  });

  it("turns provider failures into safe errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const provider = fakeProvider(() => {
      throw new Error("secret upstream detail sk-123");
    });
    const error = await extractQuotation("shot.png", PNG, provider).catch((e) => e);
    expect(error).toBeInstanceOf(ExtractionError);
    expect(error.code).toBe("ai_failed");
    expect(error.message).not.toContain("sk-123");
    spy.mockRestore();
  });
});
