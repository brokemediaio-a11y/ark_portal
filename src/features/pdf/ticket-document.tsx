import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { brand } from "@/config/brand";
import type { CustomerTicket } from "@/features/ticket/ticket-view";
import { BrandClosing, BrandHeader, scriptFont } from "./brand-frame";
import { BulletList, FlightCard, Meta, Paragraph, pdfStyles } from "./itinerary";

const c = brand.colors;

const s = StyleSheet.create({
  table: { borderWidth: 0.75, borderColor: c.border, borderRadius: 5, marginBottom: 12 },
  row: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 10, borderTopWidth: 0.5, borderTopColor: c.border },
  headRow: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 10, backgroundColor: c.surface, borderBottomWidth: 0.75, borderBottomColor: c.primary, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  head: { fontSize: 6, color: c.muted, textTransform: "uppercase", letterSpacing: 1.1 },
  name: { flex: 3, fontFamily: "Helvetica-Bold", fontSize: 8 },
  cell: { flex: 1.4, fontSize: 7.5 },
  number: { flex: 2.2, fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 0.3 },
});

function Passengers({ passengers }: { passengers: CustomerTicket["passengers"] }) {
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
          <Text style={[s.name, scriptFont(p.name)]}>{p.name}</Text>
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
}

/** The standard Ark Travelers e-ticket, whatever the supplier's format was. */
export function TicketDocument({ ticket, logoSrc = null, airlineLogos = {} }: TicketDocumentProps) {
  return (
    <Document title={`E-ticket ${ticket.bookingReference ?? ticket.ticketRef}`} author={brand.legalName} creator={brand.legalName} producer={brand.legalName}>
      <Page size="A4" style={pdfStyles.page}>
        <BrandHeader logoSrc={logoSrc} />
        {ticket.watermark && <Text style={pdfStyles.warning}>{ticket.watermark}</Text>}

        <View style={pdfStyles.titleRow}>
          <View>
            <Text style={pdfStyles.title}>Electronic Ticket</Text>
            {ticket.routeSummary && <Text style={pdfStyles.subtitle}>{ticket.routeSummary}</Text>}
          </View>
        </View>

        <View style={pdfStyles.metaGrid}>
          <Meta label="Booking reference" value={ticket.bookingReference} />
          {ticket.airlineReference && <Meta label="Airline reference" value={ticket.airlineReference} />}
          <Meta label="Issue date" value={ticket.issueDate} />
          <Meta label="Issued by" value={ticket.issuedBy} />
        </View>

        <Text style={pdfStyles.sectionTitle}>Passengers</Text>
        <Passengers passengers={ticket.passengers} />

        <Text style={pdfStyles.sectionTitle}>Itinerary</Text>
        {ticket.segments.map((segment, i) => (
          <FlightCard key={i} segment={segment} logo={segment.airlineCode ? airlineLogos[segment.airlineCode] : undefined} />
        ))}

        <Paragraph title="Fare conditions" text={ticket.fareConditions} />
        <Paragraph title="Notes" text={ticket.notes} />
        <BulletList title="Important information" items={ticket.terms} />

        <BrandClosing logoSrc={logoSrc} reference={ticket.bookingReference ? `${ticket.ticketRef} · PNR ${ticket.bookingReference}` : ticket.ticketRef} />
      </Page>
    </Document>
  );
}
