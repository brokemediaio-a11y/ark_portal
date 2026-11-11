import { describe, expect, it } from "vitest";
import { brand } from "@/config/brand";
import { buildCustomerQuote } from "@/features/quotation/customer-view";
import { createEmptyQuotation } from "@/features/quotation/factory";
import { quotationSchema } from "@/features/quotation/schema";
import { createEmptyTicket } from "./factory";
import { ticketSchema } from "./schema";
import { buildCustomerTicket } from "./ticket-view";

describe("English and Dari notes", () => {
  it("start from the defaults on new quotations and e-tickets", () => {
    expect(createEmptyQuotation().termsTextDari).toBe(brand.defaultTermsDari);
    const ticket = createEmptyTicket();
    expect(ticket.infoText).toBe(brand.ticketNotes);
    expect(ticket.infoTextDari).toBe(brand.ticketNotesDari);
    expect(buildCustomerTicket(ticket).termsDari).toHaveLength(3);
  });

  it("give documents saved before this change the defaults", () => {
    const oldQuotation: Record<string, unknown> = { ...createEmptyQuotation() };
    delete oldQuotation.termsTextDari;
    expect(quotationSchema.parse(oldQuotation).termsTextDari).toBe(brand.defaultTermsDari);
    const oldTicket: Record<string, unknown> = { ...createEmptyTicket() };
    delete oldTicket.infoText;
    delete oldTicket.infoTextDari;
    expect(ticketSchema.parse(oldTicket)).toMatchObject({ infoText: brand.ticketNotes, infoTextDari: brand.ticketNotesDari });
  });

  it("print what staff edited, one note per line, and nothing when cleared", () => {
    const quote = buildCustomerQuote({ ...createEmptyQuotation(), termsTextDari: "یک\n\n دو " });
    expect(quote.termsDari).toEqual(["یک", "دو"]);
    expect(buildCustomerTicket({ ...createEmptyTicket(), infoText: null, infoTextDari: null })).toMatchObject({ terms: [], termsDari: [] });
  });
});

describe("Dari word chunks", () => {
  it("splits only at spaces, so the letters of a word always stay together", async () => {
    const { dariWordChunks } = await import("@/features/pdf/itinerary");
    expect(dariWordChunks("لطفاً پاسپورت معتبر  خود را همراه داشته باشید.")).toEqual(["لطفاً", "پاسپورت", "معتبر", "خود", "را", "همراه", "داشته", "باشید."]);
    expect(dariWordChunks("با شرکت Ark Travelers تماس بگیرید")).toEqual(["با", "شرکت", "Ark Travelers", "تماس", "بگیرید"]);
  });
});

describe("Dari word punctuation", () => {
  it("keeps punctuation on the reading end of a lone right-to-left word and leaves marks inside the word", async () => {
    const { rtlWordForDisplay } = await import("@/features/pdf/itinerary");
    expect(rtlWordForDisplay("شماست.")).toBe(".شماست");
    expect(rtlWordForDisplay("پول،")).toBe("،پول");
    expect(rtlWordForDisplay("(مثال)")).toBe("(مثال)");
    expect(rtlWordForDisplay("لطفاً")).toBe("لطفاً");
    expect(rtlWordForDisplay("Ark.")).toBe("Ark.");
  });
});
