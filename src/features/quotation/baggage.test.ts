import { describe, expect, it } from "vitest";
import { ticketSchema } from "@/features/ticket/schema";
import { createEmptyTicket } from "@/features/ticket/factory";
import { buildCustomerQuote } from "./customer-view";
import { createEmptyQuotation, createEmptySegment } from "./factory";
import { quotationSchema } from "./schema";

describe("hand carry and check-in baggage", () => {
  it("moves the single baggage value of documents saved before the split into check-in", () => {
    const { handCarry: _h, checkIn: _c, ...oldSegment } = { ...createEmptySegment(), baggage: "30 kg" };
    void _h; void _c;
    const quotation = quotationSchema.parse({ ...createEmptyQuotation(), segments: [oldSegment] });
    expect(quotation.segments[0]).toMatchObject({ handCarry: null, checkIn: "30 kg" });
    expect(quotation.segments[0]).not.toHaveProperty("baggage");

    const ticket = ticketSchema.parse({ ...createEmptyTicket(), segments: [{ ...createEmptyTicket().segments[0], baggage: "20 kg", checkIn: undefined, handCarry: undefined }] });
    expect(ticket.segments[0]).toMatchObject({ checkIn: "20 kg", handCarry: null });
  });

  it("prints only the allowances that are filled in, and nothing when neither is", () => {
    const quote = (handCarry: string | null, checkIn: string | null) =>
      buildCustomerQuote({ ...createEmptyQuotation(), segments: [{ ...createEmptySegment(), handCarry, checkIn }] }).segments[0].baggage;
    expect(quote("7 kg", "30 kg")).toEqual({ handCarry: "7 kg", checkIn: "30 kg" });
    expect(quote(null, "30 kg")).toEqual({ handCarry: null, checkIn: "30 kg" });
    expect(quote(null, null)).toBeNull();
  });
});
