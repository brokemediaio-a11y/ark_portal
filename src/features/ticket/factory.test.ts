import { describe, expect, it } from "vitest";
import type { TicketExtraction } from "./extraction-schema";
import { ticketFromExtraction } from "./factory";
import { reviewTicket } from "./review";
import { buildCustomerTicket } from "./ticket-view";

const extraction = (passengers: TicketExtraction["passengers"]): TicketExtraction => ({
  documentHasTicketDetails: true,
  bookingReference: "1DQ779",
  airlineReference: null,
  issueDate: "2026-10-16",
  issueDateAsPrinted: "16OCT2026",
  issuedBy: "RQ KBL",
  passengers,
  segments: [
    {
      airlineName: null, airlineCode: "RQ", flightNumber: "9919", originCode: "KBL", originName: "Kabul", destinationCode: "SAW",
      destinationName: "Istanbul", departureDate: "2026-10-27", departureTime: "22:20", arrivalDate: "2026-10-28", arrivalTime: "02:30",
      duration: null, stops: null, cabin: null, handCarry: null, checkIn: "30 kg", departureTerminal: null, arrivalTerminal: null, bookingClass: "K", bookingStatus: "OK",
    },
  ],
  fareConditions: null,
  uncertainFields: [],
});

const NOORI_FAMILY = [
  { name: "NOORI / FARHAD", type: null, dateOfBirth: "1994-02-07", ticketNumber: "3842408145179" },
  { name: "NOORI / ELSA ASAL", type: null, dateOfBirth: "2023-06-14", ticketNumber: "3842408145181" },
  { name: "NOORI / MERSA", type: null, dateOfBirth: "2024-11-30", ticketNumber: "3842408145182" },
  { name: "JAWED/ERFANULLAH", type: "Adult", dateOfBirth: null, ticketNumber: null },
];

describe("ticketFromExtraction", () => {
  it("works out passenger types from dates of birth on the first flight when the ticket doesn't print them", () => {
    const ticket = ticketFromExtraction(extraction(NOORI_FAMILY), { fileNames: ["family.pdf"], demo: false });
    expect(ticket.passengers.map((p) => p.type)).toEqual(["adult", "child", "infant", "adult"]);
    expect(ticket.sourceFileNames).toEqual(["family.pdf"]);
    expect(ticket.ticketRef).toMatch(/^ARK-T-\d{6}-[A-Z0-9]{4}$/);
  });

  it("drops a badly formatted date of birth and flags it", () => {
    const ticket = ticketFromExtraction(extraction([{ name: "A/B", type: null, dateOfBirth: "07FEB94", ticketNumber: "1" }]), { fileNames: [], demo: false });
    expect(ticket.passengers[0].dateOfBirth).toBeNull();
    expect(ticket.reviewFlags.map((f) => f.field)).toContain("passengers.0.dateOfBirth");
  });
});

describe("reviewTicket", () => {
  it("blocks a ticket without a passenger name, and only warns about a missing ticket number", () => {
    const ticket = ticketFromExtraction(extraction([{ name: null, type: null, dateOfBirth: null, ticketNumber: null }]), { fileNames: [], demo: false });
    const issues = reviewTicket(ticket, "2026-10-01");
    expect(issues.filter((i) => i.level === "blocking").map((i) => i.field)).toEqual(["passengers", "passengers.0.name"]);
    expect(issues.find((i) => i.field === "passengers.0.ticketNumber")?.level).toBe("warning");
  });

  it("treats a past flight as a warning, not a blocker, on a ticket", () => {
    const ticket = ticketFromExtraction(extraction(NOORI_FAMILY), { fileNames: [], demo: false });
    const past = reviewTicket(ticket, "2026-12-01").find((i) => i.field === "segments.0.departureDate");
    expect(past?.level).toBe("warning");
  });
});

describe("buildCustomerTicket", () => {
  it("prints the carrier code with a bare flight number and the class on one line", () => {
    const view = buildCustomerTicket(ticketFromExtraction(extraction(NOORI_FAMILY), { fileNames: [], demo: false }));
    expect(view.segments[0]).toMatchObject({ flightNumber: "RQ 9919", airlineCode: "RQ", details: ["Class: K", "Status: OK"], baggage: { handCarry: null, checkIn: "30 kg" } });
    expect(view.passengers.map((p) => p.type)).toEqual(["Adult", "Child", "Infant", "Adult"]);
    expect(view.routeSummary).toBe("KBL – SAW");
  });
});
