import { describe, expect, it } from "vitest";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { extractPdfText } from "./pdf-text";
import { textInReadingOrder } from "./pdf-text-layout";

describe("PDF visual reading order", () => {
  it("reads visual rows, preserves adjacent text, and separates table columns", () => {
    expect(textInReadingOrder([
      { text: "273", x: 110, y: 41, width: 18 }, { text: "QR", x: 20, y: 40, width: 15 },
      { text: "FLIGHT ", x: 20, y: 10, width: 38 }, { text: "4 - Doha to Amsterdam", x: 58, y: 10, width: 150 },
    ])).toBe("FLIGHT 4 - Doha to Amsterdam\nQR | 273");
  });
  it("reads numbered blocks top to bottom even when PDF text objects were written backwards", async () => {
    const buffer = await renderToBuffer(<Document><Page>
      <Text style={{ position: "absolute", top: 300, left: 40, fontSize: 10 }}>FLIGHT 4 - Doha (DOH) to Amsterdam (AMS) on 14 January 2027. QR 273 departs 08:25.</Text>
      <Text style={{ position: "absolute", top: 100, left: 40, fontSize: 10 }}>FLIGHT 3 - Kabul (KBL) to Doha (DOH) on 13 January 2027. RQ 977 departs 19:30.</Text>
    </Page></Document>);
    const text = await extractPdfText(new Uint8Array(buffer));
    expect(text).not.toBeNull();
    expect(text!.indexOf("FLIGHT 3")).toBeLessThan(text!.indexOf("FLIGHT 4"));
  });
  it("still falls back to OCR for blank pages", async () => {
    const buffer = await renderToBuffer(<Document><Page><Text> </Text></Page></Document>);
    expect(await extractPdfText(new Uint8Array(buffer))).toBeNull();
  });
});
