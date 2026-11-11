import { Document, StyleSheet, Text, View } from "@react-pdf/renderer";
import { brand } from "@/config/brand";
import type { CustomerTicket } from "@/features/ticket/ticket-view";
import { BrandHeader, KEEP_WORDS, scriptFont } from "./brand-frame";
import { DocumentPage } from "./document-page";
import { BilingualNotes, FlightItinerary, Meta, MetaGrid, Paragraph, pdfStyles } from "./itinerary";
import { type PdfLayout, useMobilePdf } from "./layout";

const c = brand.colors;

const s = StyleSheet.create({
  table: { borderWidth: 0.75, borderColor: c.border, borderRadius: 5, marginBottom: 12 },
  row: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 10, borderTopWidth: 0.5, borderTopColor: c.border },
  headRow: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 10, backgroundColor: c.surface, borderBottomWidth: 0.75, borderBottomColor: c.primary, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  head: { fontSize: 6, color: c.muted, textTransform: "uppercase", letterSpacing: 1.1 },
  name: { flex: 3, fontFamily: "Helvetica-Bold", fontSize: 8 },
  cell: { flex: 1.4, fontSize: 7.5 },
  number: { flex: 2.2, fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 0.3 },
  /** Mobile: one block per passenger — the name, then type, date of birth and ticket number underneath. */
  mobileRow: { paddingVertical: 6, paddingHorizontal: 10, borderTopWidth: 0.5, borderTopColor: c.border },
  mobileFacts: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  mobileFact: { marginRight: 14, marginBottom: 2 },
  mobileValue: { fontSize: 7.5, marginTop: 1.5 },
});

function MobilePassengers({ passengers }: { passengers: CustomerTicket["passengers"] }) {
  return (
    <View style={s.table}>
      {passengers.map((p, i) => (
        <View key={`${p.name}-${i}`} style={i === 0 ? [s.mobileRow, { borderTopWidth: 0 }] : s.mobileRow} wrap={false}>
          <Text {...KEEP_WORDS} style={[s.name, { flexGrow: 0, flexShrink: 0, flexBasis: "auto" }, scriptFont(p.name)]}>{p.name}</Text>
          <View style={s.mobileFacts}>
            {([["Type", p.type], ["Date of birth", p.dateOfBirth], ["E-ticket number", p.ticketNumber]] as const).map(([label, value]) => (
              <View key={label} style={s.mobileFact}>
                <Text style={s.head}>{label}</Text>
                <Text style={label === "E-ticket number" ? [s.mobileValue, { fontFamily: "Helvetica-Bold" }] : s.mobileValue}>{value ?? "—"}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function Passengers({ passengers }: { passengers: CustomerTicket["passengers"] }) {
  if (useMobilePdf()) return <MobilePassengers passengers={passengers} />;
  return (
    <View style={s.table} wrap={false}>
      <View style={s.headRow}>
        <Text style={[s.head, { flex: 3 }]}>Passenger</Text>
        <Text style={[s.head, { flex: 1.4 }]}>Type</Text>
        <Text style={[s.head, { flex: 1.4 }]}>Date of birth</Text>
        <Text style={[s.head, { flex: 2.2 }]}>E-ticket number</Text>
      </View>
      {passengers.map((p, i) => (
        <View key={`${p.name}-${i}`} style={i === 0 ? [s.row, { borderTopWidth: 0 }] : s.row}>
          <Text {...KEEP_WORDS} style={[s.name, scriptFont(p.name)]}>{p.name}</Text>
          <Text style={s.cell}>{p.type ?? "—"}</Text>
          <Text style={s.cell}>{p.dateOfBirth ?? "—"}</Text>
          <Text style={s.number}>{p.ticketNumber ?? "—"}</Text>
        </View>
      ))}
    </View>
  );
}

interface TicketDocumentProps {
  ticket: CustomerTicket;
  logoSrc?: string | null;
  airlineLogos?: Record<string, string>;
  layout?: PdfLayout;
}

/** The standard Ark Travelers e-ticket, whatever the supplier's format was. */
export function TicketDocument({ ticket, logoSrc = null, airlineLogos = {}, layout = "desktop" }: TicketDocumentProps) {
  return (
    <Document title={`E-ticket ${ticket.bookingReference ?? ticket.ticketRef}`} author={brand.legalName} creator={brand.legalName} producer={brand.legalName}>
      <DocumentPage layout={layout} reference={ticket.bookingReference ? `${ticket.ticketRef} · PNR ${ticket.bookingReference}` : ticket.ticketRef}>
        <BrandHeader logoSrc={logoSrc} />
        {ticket.watermark && <Text style={pdfStyles.warning}>{ticket.watermark}</Text>}

        <View style={pdfStyles.titleRow}>
          <View>
            <Text style={pdfStyles.title}>Electronic Ticket</Text>
            {ticket.routeSummary && <Text style={pdfStyles.subtitle}>{ticket.routeSummary}</Text>}
          </View>
        </View>

        <MetaGrid>
          <Meta label="Booking reference" value={ticket.bookingReference} />
          {ticket.airlineReference && <Meta label="Airline reference" value={ticket.airlineReference} />}
          <Meta label="Issue date" value={ticket.issueDate} />
          <Meta label="Issued by" value={ticket.issuedBy} />
        </MetaGrid>

        <Text style={pdfStyles.sectionTitle} minPresenceAhead={60}>Passengers</Text>
        <Passengers passengers={ticket.passengers} />

        <FlightItinerary title="Itinerary" segments={ticket.segments} airlineLogos={airlineLogos} />

        <Paragraph title="Fare conditions" text={ticket.fareConditions} />
        <Paragraph title="Notes" text={ticket.notes} />
        <BilingualNotes title="Important information" dariTitle={brand.ticketNotesDariTitle} items={ticket.terms} dariItems={ticket.termsDari} />

      </DocumentPage>
    </Document>
  );
}
