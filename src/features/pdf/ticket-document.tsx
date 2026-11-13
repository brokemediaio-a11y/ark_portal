import { Document, StyleSheet, Text, View } from "@react-pdf/renderer";
import { brand } from "@/config/brand";
import type { CoveredFlights, CustomerPassenger, CustomerTicket, FlightTag } from "@/features/ticket/ticket-view";
import { BrandHeader, KEEP_WORDS, scriptFont } from "./brand-frame";
import { DocumentPage } from "./document-page";
import { AirlineMark, BilingualNotes, FlightItinerary, Meta, MetaGrid, Paragraph, pdfStyles } from "./itinerary";
import { type PdfLayout, useMobilePdf } from "./layout";

const c = brand.colors;

const s = StyleSheet.create({
  table: { borderWidth: 0.75, borderColor: c.border, borderRadius: 5, marginBottom: 12 },
  row: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 10, borderTopWidth: 0.5, borderTopColor: c.border },
  headRow: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 10, backgroundColor: c.surface, borderBottomWidth: 0.75, borderBottomColor: c.primary, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  head: { fontSize: 6, color: c.muted, textTransform: "uppercase", letterSpacing: 1.1 },
  name: { flex: 3, fontFamily: "Helvetica-Bold", fontSize: 8 },
  cell: { flex: 1.4, fontSize: 7.5 },
  numberText: { fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 0.3 },
  /** Mobile: one compact card per passenger — the name, a line with type and date of birth, then the tickets. */
  mobileCard: { borderWidth: 0.75, borderColor: c.border, borderRadius: 5, paddingVertical: 5, paddingHorizontal: 8, marginBottom: 6 },
  mobileInfo: { fontSize: 7, color: c.muted, marginTop: 1.5 },
  mobileLabel: { marginTop: 5, marginBottom: 1 },
  /** A reference or ticket number, its flights underneath. */
  covered: { marginBottom: 2 },
  tags: { flexDirection: "row", flexWrap: "wrap", marginTop: 1.5 },
  /** In a grid column the flights stack, one per line. */
  tagsStacked: { flexDirection: "column", marginTop: 1.5 },
  tag: { flexDirection: "row", alignItems: "center", marginRight: 8, marginBottom: 1 },
  tagText: { fontSize: 6.5, color: c.muted },
  /** Side-by-side columns that wrap onto a new row when there are more items than columns. */
  grid: { flexDirection: "row", flexWrap: "wrap" },
  gridCell: { paddingVertical: 5, paddingHorizontal: 8 },
  columnDivider: { borderLeftWidth: 0.5, borderLeftColor: c.border },
  rowDivider: { borderTopWidth: 0.5, borderTopColor: c.border },
});

/** A booking reference or e-ticket number, then the flights it covers (logo or plane, "Flight 1 · TK1800"). */
function CoveredFlightsLine({ item, airlineLogos, showFlights, stacked = false, size = 8 }: { item: CoveredFlights; airlineLogos: Record<string, string>; showFlights: boolean; stacked?: boolean; size?: number }) {
  return (
    <View style={s.covered}>
      <Text style={[s.numberText, { fontSize: size }]}>{item.value}</Text>
      {showFlights && item.flights.length > 0 && (
        <View style={stacked ? s.tagsStacked : s.tags}>
          {item.flights.map((f) => <FlightTagView key={f.title} tag={f} logo={f.airlineCode ? airlineLogos[f.airlineCode] : undefined} />)}
        </View>
      )}
    </View>
  );
}

function FlightTagView({ tag, logo }: { tag: FlightTag; logo: string | undefined }) {
  return (
    <View style={s.tag}>
      <AirlineMark airline={tag} src={logo} size={9} />
      <Text style={s.tagText}>{[tag.title, tag.flightNumber].filter(Boolean).join(" · ")}</Text>
    </View>
  );
}

/**
 * References or ticket numbers side by side, as many columns as there are items up to maxColumns; more items wrap
 * onto further rows. Thin lines separate the columns and rows.
 */
function ColumnGrid({ items, maxColumns, airlineLogos, showFlights = true, size, padded = true }: { items: CoveredFlights[]; maxColumns: number; airlineLogos: Record<string, string>; showFlights?: boolean; size?: number; padded?: boolean }) {
  const columns = Math.max(1, Math.min(maxColumns, items.length));
  return (
    <View style={s.grid}>
      {items.map((item, i) => (
        <View
          key={item.value}
          style={[s.gridCell, { width: `${100 / columns}%` }, padded ? {} : { paddingVertical: 2, paddingHorizontal: i % columns === 0 ? 0 : 6 }, i % columns !== 0 ? s.columnDivider : {}, i >= columns ? s.rowDivider : {}]}
        >
          <CoveredFlightsLine item={item} airlineLogos={airlineLogos} showFlights={showFlights} stacked size={size} />
        </View>
      ))}
    </View>
  );
}

/** Flights are named only when the traveller holds more than one ticket; a single ticket covers them all. */
function TicketNumbers({ passenger, airlineLogos, size }: { passenger: CustomerPassenger; airlineLogos: Record<string, string>; size?: number }) {
  if (!passenger.tickets.length) return <Text style={[s.numberText, { fontSize: size ?? 8 }]}>—</Text>;
  const several = passenger.tickets.length > 1;
  return <View>{passenger.tickets.map((t) => <CoveredFlightsLine key={t.value} item={t} airlineLogos={airlineLogos} showFlights={several} size={size} />)}</View>;
}

/**
 * Mobile: one compact card per passenger, each straight on the page so it moves to the next page whole; the section
 * title sits in the first card's block, so it never stays behind at the bottom of a page. Several tickets sit side by
 * side in columns.
 */
function MobilePassengers({ passengers, airlineLogos }: { passengers: CustomerPassenger[]; airlineLogos: Record<string, string> }) {
  return (
    <>
      {passengers.map((p, i) => {
        const info = [p.type, p.dateOfBirth && `Born ${p.dateOfBirth}`].filter(Boolean).join(" · ");
        return (
          <View key={`${p.name}-${i}`} wrap={false} style={{ flexShrink: 0 }}>
            {i === 0 && <Text style={pdfStyles.sectionTitle}>Passengers</Text>}
            <View style={s.mobileCard}>
              <Text {...KEEP_WORDS} style={[s.name, { flexGrow: 0, flexShrink: 0, flexBasis: "auto" }, scriptFont(p.name)]}>{p.name}</Text>
              {info && <Text style={s.mobileInfo}>{info}</Text>}
              <Text style={[s.head, s.mobileLabel]}>{p.tickets.length > 1 ? "E-ticket numbers" : "E-ticket number"}</Text>
              {p.tickets.length > 1
                ? <ColumnGrid items={p.tickets} maxColumns={3} airlineLogos={airlineLogos} size={7.5} padded={false} />
                : <TicketNumbers passenger={p} airlineLogos={airlineLogos} size={7.5} />}
            </View>
          </View>
        );
      })}
    </>
  );
}

function Passengers({ passengers, airlineLogos }: { passengers: CustomerPassenger[]; airlineLogos: Record<string, string> }) {
  if (useMobilePdf()) return <MobilePassengers passengers={passengers} airlineLogos={airlineLogos} />;
  return (
    <>
      <Text style={pdfStyles.sectionTitle} minPresenceAhead={60}>Passengers</Text>
      <View style={s.table} wrap={false}>
        <View style={s.headRow}>
          <Text style={[s.head, { flex: 3 }]}>Passenger</Text>
          <Text style={[s.head, { flex: 1.4 }]}>Type</Text>
          <Text style={[s.head, { flex: 1.4 }]}>Date of birth</Text>
          <Text style={[s.head, { flex: 2.6 }]}>E-ticket number</Text>
        </View>
        {passengers.map((p, i) => (
          <View key={`${p.name}-${i}`} style={i === 0 ? [s.row, { borderTopWidth: 0 }] : s.row}>
            <Text {...KEEP_WORDS} style={[s.name, scriptFont(p.name)]}>{p.name}</Text>
            <Text style={s.cell}>{p.type ?? "—"}</Text>
            <Text style={s.cell}>{p.dateOfBirth ?? "—"}</Text>
            <View style={{ flex: 2.6 }}><TicketNumbers passenger={p} airlineLogos={airlineLogos} /></View>
          </View>
        ))}
      </View>
    </>
  );
}

/** Several suppliers, several bookings: each reference with the flights booked under it, side by side in columns. */
function Bookings({ bookings, airlineLogos }: { bookings: CoveredFlights[]; airlineLogos: Record<string, string> }) {
  const mobile = useMobilePdf();
  // The title and the list form one block, so the title never stays behind at the bottom of a page.
  return (
    <View wrap={false} style={{ flexShrink: 0 }}>
      <Text style={pdfStyles.sectionTitle}>Booking references</Text>
      <View style={[s.table, mobile ? { marginBottom: 8 } : {}]}>
        <ColumnGrid items={bookings} maxColumns={mobile ? 3 : 4} airlineLogos={airlineLogos} />
      </View>
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
          {ticket.bookings.length <= 1 && <Meta label="Booking reference" value={ticket.bookingReference} />}
          {ticket.airlineReference && <Meta label="Airline reference" value={ticket.airlineReference} />}
          <Meta label="Issue date" value={ticket.issueDate} />
          <Meta label="Issued by" value={ticket.issuedBy} />
        </MetaGrid>

        {ticket.bookings.length > 1 && <Bookings bookings={ticket.bookings} airlineLogos={airlineLogos} />}

        <Passengers passengers={ticket.passengers} airlineLogos={airlineLogos} />

        <FlightItinerary title="Itinerary" segments={ticket.segments} airlineLogos={airlineLogos} />

        <Paragraph title="Fare conditions" text={ticket.fareConditions} />
        <Paragraph title="Notes" text={ticket.notes} />
        <BilingualNotes title="Important information" dariTitle={brand.ticketNotesDariTitle} items={ticket.terms} dariItems={ticket.termsDari} />
      </DocumentPage>
    </Document>
  );
}
