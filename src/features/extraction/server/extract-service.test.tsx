import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { extractQuotation } from "./extract-service";
import { mockExtractionProvider } from "./providers/mock";
import { ExtractionError, type ExtractionInput, type ExtractionProvider } from "./providers/types";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(1)]);

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

/** A provider that records its input and returns a fixed response. */
function fakeProvider(response: unknown | (() => never)): ExtractionProvider & { calls: ExtractionInput[] } {
  const calls: ExtractionInput[] = [];
  return {
    name: "fake",
    isDemo: false,
    calls,
    async extract(input) {
      calls.push(input);
      return typeof response === "function" ? (response as () => never)() : structuredClone(response);
    },
  };
}

let demoData: unknown;
let textPdf: Uint8Array;
let scannedPdf: Uint8Array;

beforeAll(async () => {
  demoData = await mockExtractionProvider.extract({ kind: "text", text: "" }, new AbortController().signal);
  textPdf = await makePdf(
    "Flight EK 623 Lahore (LHE) to Dubai (DXB) departing 10 December 2026 at 04:15, arriving 06:45. Total fare PKR 185,000 for 2 adults. Baggage 30kg.",
  );
  scannedPdf = await makePdf(" ");
});

describe("extractQuotation", () => {
  it("uses the PDF text layer when present", async () => {
    const provider = fakeProvider(demoData);
    const result = await extractQuotation("quote.pdf", textPdf, provider);
    expect(provider.calls[0].kind).toBe("text");
    expect(provider.calls[0].kind === "text" && provider.calls[0].text).toContain("EK 623");
    expect(result.method).toBe("pdf-text");
  });

  it("falls back to vision for scanned PDFs and images", async () => {
    const provider = fakeProvider(demoData);
    await extractQuotation("scan.pdf", scannedPdf, provider);
    await extractQuotation("shot.png", PNG, provider);
    expect(provider.calls.map((c) => c.kind === "file" && c.mimeType)).toEqual(["application/pdf", "image/png"]);
  });

  it("rejects invalid files before calling the AI", async () => {
    const provider = fakeProvider(demoData);
    await expect(extractQuotation("quote.pdf", PNG, provider)).rejects.toMatchObject({ code: "invalid_file" });
    expect(provider.calls).toHaveLength(0);
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
