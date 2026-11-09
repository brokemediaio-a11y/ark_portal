import { beforeAll, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { renderToBuffer } from "@react-pdf/renderer";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { getDocumentProxy, renderPageAsImage } from "unpdf";
import { createEmptyQuotation, createEmptySegment } from "@/features/quotation/factory";
import { buildCustomerQuote } from "@/features/quotation/customer-view";
import { createEmptyTicket } from "@/features/ticket/factory";
import { buildCustomerTicket } from "@/features/ticket/ticket-view";
import { registerPdfFonts } from "./brand-frame";
import { QuotationDocument } from "./quotation-document";
import { TicketDocument } from "./ticket-document";

beforeAll(() => registerPdfFonts(resolve("public/fonts/Vazirmatn-Bold.ttf")));
const logoSrc = resolve("public/brand/ark-logo-white.png");

describe("content-sized PDFs", () => {
  for (const kind of ["quotation", "ticket"] as const) {
    for (const long of [false, true]) {
      it(`${kind}: ${long ? "long documents grow without losing content" : "short documents avoid unnecessary blank space"} and the footer fills the width`, async () => {
        const quotation = createEmptyQuotation();
        const ticket = createEmptyTicket();
        const document = kind === "quotation" ? quotation : ticket;
        document.segments = Array.from({ length: long ? 8 : 1 }, (_, index) => ({
          ...document.segments[0], id: `flight-${index}`, airlineName: "Example Airlines", airlineCode: "EA",
          flightNumber: `EA ${100 + index}`, originCode: "HAM", destinationCode: "VIE",
          originName: "Hamburg", destinationName: "Vienna", departureDate: "2026-12-15", departureTime: "17:45",
          arrivalDate: "2026-12-15", arrivalTime: "19:15", duration: "1h 30m", cabin: "Economy", stops: 0,
        }));
        document.notes = long ? `${"Review all travel documents before departure. ".repeat(120)}Final itinerary note.` : "Final itinerary note.";
        ticket.passengers = Array.from({ length: long ? 30 : 1 }, (_, index) => ({
          id: `passenger-${index}`, name: `Passenger ${index + 1}`, type: "adult", dateOfBirth: "1990-01-01", ticketNumber: `123456789${index}`,
        }));
        const element = kind === "quotation"
          ? <QuotationDocument quote={buildCustomerQuote(quotation)} logoSrc={logoSrc} />
          : <TicketDocument ticket={buildCustomerTicket(ticket)} logoSrc={logoSrc} />;
        const buffer = await renderToBuffer(element);
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        expect(pdf.numPages).toBe(1);
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        expect(viewport.width).toBeCloseTo(595.28, 1);
        if (long) expect(viewport.height).toBeGreaterThan(841.89);
        else expect(viewport.height).toBeLessThan(841.89);
        const text = await page.getTextContent();
        const items = text.items.filter(item => "str" in item);
        const contents = items.map(item => item.str).join(" ");
        expect(contents).toContain("Final itinerary note.");
        expect(contents.replace(/\s/g, "")).toContain("THANKYOUFORCHOOSING");
        expect(contents).toContain("All rights reserved.");
        if (kind === "ticket" && long) expect(contents).toContain("Passenger 30");
        for (const item of items) {
          expect(item.transform[5]).toBeGreaterThanOrEqual(0);
          expect(item.transform[5]).toBeLessThan(viewport.height);
        }
        const png = await renderPageAsImage(new Uint8Array(buffer), 1, { canvasImport: () => import("@napi-rs/canvas"), scale: 1 });
        const image = await loadImage(Buffer.from(png));
        const canvas = createCanvas(image.width, image.height); const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0);
        // Check both physical page edges, away from the footer text and rule.
        for (const x of [0, image.width - 1]) {
          const pixel = ctx.getImageData(x, image.height - 25, 1, 1).data;
          expect(pixel[0]).toBeLessThan(80); expect(pixel[1]).toBeLessThan(90); expect(pixel[2]).toBeLessThan(100);
          const bottomCorner = ctx.getImageData(x, image.height - 1, 1, 1).data;
          expect(bottomCorner[0]).toBeLessThan(80);
        }
        // Optional review artifacts, kept outside the repository.
        if (process.env.PDF_PREVIEW_DIR) {
          mkdirSync(process.env.PDF_PREVIEW_DIR, { recursive: true });
          const name = `${kind}-${long ? "long" : "short"}`;
          writeFileSync(resolve(process.env.PDF_PREVIEW_DIR, `${name}.pdf`), buffer);
          writeFileSync(resolve(process.env.PDF_PREVIEW_DIR, `${name}.png`), Buffer.from(png));
        }
      }, 20_000);
    }
  }
  for (const kind of ["quotation", "ticket"] as const) {
    it(`${kind}: prints durations and decorated connections for a complete return journey`, async () => {
      const routes = [
        ["AMS", "Amsterdam", "DOH", "Doha", "2026-12-12", "15:05", "2026-12-12", "23:20", "QR 274"],
        ["DOH", "Doha", "KBL", "Kabul", "2026-12-13", "03:00", "2026-12-13", "08:10", "RQ 978"],
        ["KBL", "Kabul", "DOH", "Doha", "2027-01-13", "19:30", "2027-01-13", "22:00", "RQ 977"],
        ["DOH", "Doha", "AMS", "Amsterdam", "2027-01-14", "08:25", "2027-01-14", "13:20", "QR 273"],
      ];
      const segments = routes.map(([originCode, originName, destinationCode, destinationName, departureDate, departureTime, arrivalDate, arrivalTime, flightNumber]) => ({
        ...createEmptySegment(), originCode, originName, destinationCode, destinationName, departureDate, departureTime, arrivalDate, arrivalTime, flightNumber, cabin: "Economy", baggage: "40 kg",
      }));
      const quotation = { ...createEmptyQuotation(), segments };
      const ticket = createEmptyTicket(); ticket.passengers[0].name = "Example / Traveller";
      ticket.segments = segments.map(segment => ({ ...ticket.segments[0], ...segment }));
      const element = kind === "quotation" ? <QuotationDocument quote={buildCustomerQuote(quotation)} logoSrc={logoSrc} /> : <TicketDocument ticket={buildCustomerTicket(ticket)} logoSrc={logoSrc} />;
      const buffer = await renderToBuffer(element);
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      expect(pdf.numPages).toBe(1);
      const page = await pdf.getPage(1); const text = await page.getTextContent();
      const contents = text.items.filter(item => "str" in item).map(item => item.str).join(" ");
      for (const phrase of ["6h 15m", "3h 40m layover", "31d 11h 20m between flights", "10h 25m layover", "6h 55m"]) expect(contents).toContain(phrase);
      if (process.env.PDF_PREVIEW_DIR) {
        mkdirSync(process.env.PDF_PREVIEW_DIR, { recursive: true });
        writeFileSync(resolve(process.env.PDF_PREVIEW_DIR, `${kind}-connections.pdf`), buffer);
        const png = await renderPageAsImage(new Uint8Array(buffer), 1, { canvasImport: () => import("@napi-rs/canvas"), scale: 1.5 });
        writeFileSync(resolve(process.env.PDF_PREVIEW_DIR, `${kind}-connections.png`), Buffer.from(png));
      }
    }, 20_000);
  }
});
