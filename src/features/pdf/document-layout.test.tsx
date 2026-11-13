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
import { PAGE_PADDING_X, registerPdfFonts } from "./brand-frame";
import { QuotationDocument } from "./quotation-document";
import { TicketDocument } from "./ticket-document";
import { MOBILE_PAGE } from "./layout";

beforeAll(() => registerPdfFonts(resolve("public/fonts/Vazirmatn-Bold.ttf")));
const logoSrc = resolve("public/brand/ark-logo-white.png");

describe("content-sized PDFs", () => {
  for (const kind of ["quotation", "ticket"] as const) {
    for (const long of [false, true]) {
      it(`${kind}: ${long ? "long documents grow without losing content" : "short documents avoid unnecessary blank space"} and header and footer panels sit inside the margins`, async () => {
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
          id: `passenger-${index}`, name: `Passenger ${index + 1}`, type: "adult", dateOfBirth: "1990-01-01", ticketNumber: `123456789${index}`, flightTicketNumbers: {},
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
        const pixel = (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data;
        /** The logo tile's #A4AFB9. */
        const isLogoTile = ([r, g, b]: Uint8ClampedArray) => r > 140 && r < 190 && b > r && Math.abs(r - g) < 25;
        /** The light-blue (#D9E8F5) end of the band. */
        const isBandBlue = ([r, , b]: Uint8ClampedArray) => r > 200 && r < 235 && b > 235 && b > r;
        const isWhite = ([r, g, b]: Uint8ClampedArray) => r > 245 && g > 245 && b > 245;
        // Header and footer sit inside the page margins, the band fading to blue at the
        // right margin, white page beyond. Only the header has the logo tile.
        const headerY = 62;
        const footerY = image.height - 28 - 40;
        for (const y of [headerY, footerY]) {
          expect(isWhite(pixel(0, y))).toBe(true);
          expect(isWhite(pixel(image.width - 1, y))).toBe(true);
          // The footer's contact column is flush with the right margin, so look for the band
          // a few pixels above and below, between its lines of text.
          const nearby = [-6, -3, 0, 3, 6].map((dy) => pixel(image.width - PAGE_PADDING_X - 2, y + dy));
          expect(nearby.some(isBandBlue)).toBe(true);
        }
        expect(isLogoTile(pixel(PAGE_PADDING_X + 4, headerY))).toBe(true);
        expect(isLogoTile(pixel(PAGE_PADDING_X + 4, footerY))).toBe(false);
        expect(isWhite(pixel(0, image.height - 1))).toBe(true);
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
        ...createEmptySegment(), originCode, originName, destinationCode, destinationName, departureDate, departureTime, arrivalDate, arrivalTime, flightNumber, cabin: "Economy", handCarry: "7 kg", checkIn: "40 kg",
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

describe("mobile PDFs", () => {
  const routes = [
    ["AMS", "Amsterdam", "DOH", "Doha", "2026-12-12", "15:05", "2026-12-12", "23:20", "QR 274"],
    ["DOH", "Doha", "KBL", "Kabul", "2026-12-13", "03:00", "2026-12-13", "08:10", "RQ 978"],
    ["KBL", "Kabul", "DOH", "Doha", "2027-01-13", "19:30", "2027-01-13", "22:00", "RQ 977"],
    ["DOH", "Doha", "AMS", "Amsterdam", "2027-01-14", "08:25", "2027-01-14", "13:20", "QR 273"],
  ];
  const segments = routes.map(([originCode, originName, destinationCode, destinationName, departureDate, departureTime, arrivalDate, arrivalTime, flightNumber]) => ({
    ...createEmptySegment(), originCode, originName, destinationCode, destinationName, departureDate, departureTime, arrivalDate, arrivalTime, flightNumber,
    airlineName: "Example Airlines", cabin: "Economy", handCarry: "7 kg", checkIn: "40 kg",
  }));

  for (const kind of ["quotation", "ticket"] as const) {
    it(`${kind}: uses phone-sized pages, keeps every flight card whole on one page and ends with the footer`, async () => {
      const quotation = { ...createEmptyQuotation(), segments };
      const ticket = createEmptyTicket();
      ticket.segments = segments.map((segment) => ({ ...ticket.segments[0], ...segment }));
      ticket.passengers = Array.from({ length: 12 }, (_, index) => ({
        id: `passenger-${index}`, name: `Passenger ${index + 1}`, type: "adult", dateOfBirth: "1990-01-01", ticketNumber: `123456789${index}`, flightTicketNumbers: {},
      }));
      const element = kind === "quotation"
        ? <QuotationDocument quote={buildCustomerQuote(quotation)} logoSrc={logoSrc} layout="mobile" />
        : <TicketDocument ticket={buildCustomerTicket(ticket)} logoSrc={logoSrc} layout="mobile" />;
      const buffer = await renderToBuffer(element);
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      expect(pdf.numPages).toBeGreaterThan(1);

      const pages: string[] = [];
      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number);
        const viewport = page.getViewport({ scale: 1 });
        expect(viewport.width).toBeCloseTo(MOBILE_PAGE.width, 1);
        expect(viewport.height).toBeCloseTo(MOBILE_PAGE.height, 1);
        const items = (await page.getTextContent()).items.filter((item) => "str" in item);
        // Nothing runs off the page on any side.
        for (const item of items) {
          if (!item.str.trim()) continue;
          expect(item.transform[4]).toBeGreaterThanOrEqual(0);
          expect(item.transform[4] + item.width).toBeLessThanOrEqual(viewport.width + 0.5);
          expect(item.transform[5]).toBeGreaterThanOrEqual(0);
          expect(item.transform[5]).toBeLessThan(viewport.height);
        }
        pages.push(items.map((item) => item.str).join(" "));
      }

      // Each card's heading, flight number, arrival time and baggage are all on one page: no card is cut in half.
      routes.forEach(([, , , , , , , arrivalTime, flightNumber], index) => {
        const page = pages.find((text) => text.includes(flightNumber));
        expect(page, flightNumber).toBeDefined();
        // Letter-spaced headings come out of the PDF one letter at a time, so compare without spaces.
        const compact = page!.replace(/\s/g, "").toLowerCase();
        for (const part of [`Flight${index + 1}`, arrivalTime, "Baggage", "40kg"]) expect(compact).toContain(part.toLowerCase());
      });
      const last = pages.at(-1)!;
      expect(last).toContain("All rights reserved.");
      expect(last).toContain(`${pdf.numPages} / ${pdf.numPages}`);
      if (kind === "ticket") expect(pages.join(" ")).toContain("Passenger 12");
    }, 30_000);
  }

  /** Text items on a page, with their distance from the top of the page. */
  async function pageText(buffer: Buffer, number: number) {
    const page = await (await getDocumentProxy(new Uint8Array(buffer))).getPage(number);
    const height = page.getViewport({ scale: 1 }).height;
    return (await page.getTextContent()).items.flatMap((item) => ("str" in item && item.str.trim() ? [{ str: item.str, top: height - item.transform[5] }] : []));
  }

  it("keeps the header on one row: names and every contact line sit in the header band", async () => {
    const buffer = await renderToBuffer(<QuotationDocument quote={buildCustomerQuote({ ...createEmptyQuotation(), segments })} logoSrc={logoSrc} layout="mobile" />);
    const items = await pageText(buffer, 1);
    const find = (str: string) => items.find((item) => item.str.includes(str));
    const contacts = ["+46 700 101 401", "+4915 25 71 11 901", "info@arktravelers.com", "www.arktravelers.com"].map((s) => find(s));
    for (const contact of contacts) expect(contact).toBeDefined();
    // The four contact lines stack in one column, each on a single line, beside the company name.
    const tops = contacts.map((contact) => contact!.top);
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(40);
    expect(find("Ark Travelers AB")!.top).toBeGreaterThan(Math.min(...tops));
    expect(find("Ark Travelers AB")!.top).toBeLessThan(Math.max(...tops));
  }, 30_000);

  it("sets the footer at the bottom of the last page, and moves it to a new page only when it does not fit", async () => {
    const base = buildCustomerQuote({ ...createEmptyQuotation(), segments: segments.slice(0, 1) });
    const pageCounts = new Set<number>();
    let sharedPage = false;
    for (let count = 0; count <= 40; count += 2) {
      const quote = { ...base, terms: Array.from({ length: count }, (_, i) => `Term number ${i + 1}, long enough to take a full line of the page.`) };
      const buffer = await renderToBuffer(<QuotationDocument quote={quote} logoSrc={logoSrc} layout="mobile" />);
      const pages = (await getDocumentProxy(new Uint8Array(buffer))).numPages;
      pageCounts.add(pages);
      const last = await pageText(buffer, pages);
      const follow = last.find((item) => item.str.replace(/\s/g, "").toLowerCase().includes("followus"))!;
      const rights = last.find((item) => item.str.includes("All rights reserved."))!;
      // The footer's last line sits just above the page number, at the bottom of the page.
      expect(rights.top, `${count} terms`).toBeGreaterThan(MOBILE_PAGE.height - 50);
      // The footer only gets a page of its own when it can't fit under the content.
      const contentAbove = last.some((item) => item.top < follow.top - 20);
      if (contentAbove) sharedPage = true;
    }
    expect(pageCounts.size).toBeGreaterThan(1);
    expect(sharedPage).toBe(true);
  }, 120_000);
});

describe("contact links", () => {
  it("opens WhatsApp from the header numbers and the phone app from the footer numbers", async () => {
    const buffer = await renderToBuffer(<TicketDocument ticket={buildCustomerTicket(createEmptyTicket())} logoSrc={logoSrc} />);
    const page = await (await getDocumentProxy(new Uint8Array(buffer))).getPage(1);
    const height = page.getViewport({ scale: 1 }).height;
    const links = (await page.getAnnotations()).flatMap((a: { url?: string; rect: number[] }) => (a.url ? [{ url: a.url, top: height - a.rect[3] }] : []));
    const whatsApp = links.filter((l) => l.url.startsWith("https://wa.me/"));
    const calls = links.filter((l) => l.url.startsWith("tel:"));
    expect(whatsApp.map((l) => l.url)).toEqual(["https://wa.me/46700101401", "https://wa.me/4915257111901"]);
    expect(calls.map((l) => l.url)).toEqual(["tel:+46700101401", "tel:+4915257111901"]);
    // WhatsApp in the header at the top, calls in the footer at the bottom.
    expect(Math.max(...whatsApp.map((l) => l.top))).toBeLessThan(Math.min(...calls.map((l) => l.top)));
  });
});

describe("mobile e-ticket with several bookings", () => {
  it("fits the booking references and the passenger's tickets on the first page", async () => {
    const ticket = createEmptyTicket();
    ticket.segments = ["TIKVND", "PTX09", "PTX0C", "TIKVND"].map((bookingReference, i) => ({
      ...ticket.segments[0], id: `s${i}`, flightNumber: `TK ${1800 + i}`, airlineName: i % 3 ? null : "Turkish Airlines",
      originCode: "IST", destinationCode: "IFN", departureDate: "2026-11-17", departureTime: "18:15", arrivalDate: "2026-11-17", arrivalTime: "23:45", bookingReference,
    }));
    ticket.bookingReference = "TIKVND";
    ticket.passengers = [{ id: "p", name: "SAMADI/KAZEM", type: null, dateOfBirth: null, ticketNumber: "235-2531625879", flightTicketNumbers: { s1: "6482404179838", s2: "6482404179839" } }];
    const buffer = await renderToBuffer(<TicketDocument ticket={buildCustomerTicket(ticket)} logoSrc={logoSrc} layout="mobile" />);
    const first = await (await getDocumentProxy(new Uint8Array(buffer))).getPage(1);
    const text = (await first.getTextContent()).items.map((item) => ("str" in item ? item.str : "")).join(" ").replace(/\s/g, "");
    for (const value of ["PTX09", "PTX0C", "TIKVND", "SAMADI/KAZEM", "235-2531625879", "6482404179838", "6482404179839"]) expect(text, value).toContain(value);
  }, 30_000);
});
