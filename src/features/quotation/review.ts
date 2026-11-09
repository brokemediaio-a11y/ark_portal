import { localToday } from "@/lib/dates";
import {
  AIRLINE_CODE,
  CURRENCY_CODE,
  IATA_CODE,
  ISO_DATE,
  TIME_24H,
  type FlightSegment,
  type Quotation,
} from "./schema";

/**
 * Review rules: decide which values a human must look at before the
 * quotation can go to a customer. "blocking" issues prevent PDF generation.
 */

export type IssueLevel = "blocking" | "warning";

export interface ReviewIssue {
  field: string;
  level: IssueLevel;
  message: string;
}

export const SEGMENT_FIELD_LABELS: Record<keyof Omit<FlightSegment, "id">, string> = {
  airlineName: "Airline",
  airlineCode: "Airline code",
  flightNumber: "Flight number",
  originCode: "From (airport code)",
  originName: "From (city / airport)",
  destinationCode: "To (airport code)",
  destinationName: "To (city / airport)",
  departureDate: "Departure date",
  departureTime: "Departure time",
  arrivalDate: "Arrival date",
  arrivalTime: "Arrival time",
  duration: "Duration",
  stops: "Stops",
  cabin: "Cabin class",
  baggage: "Baggage",
};

export const segmentField = (index: number, key: keyof FlightSegment) => `segments.${index}.${key}`;

function checkFormat(
  issues: ReviewIssue[],
  field: string,
  value: string | null,
  pattern: RegExp,
  message: string,
) {
  if (value && !pattern.test(value)) issues.push({ field, level: "blocking", message });
}

export function reviewSegment(segment: FlightSegment, index: number, today: string): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const f = (key: keyof FlightSegment) => segmentField(index, key);
  const label = `Flight ${index + 1}`;

  if (!segment.originCode && !segment.originName)
    issues.push({ field: f("originCode"), level: "blocking", message: `${label}: where does it depart from?` });
  if (!segment.destinationCode && !segment.destinationName)
    issues.push({ field: f("destinationCode"), level: "blocking", message: `${label}: where does it arrive?` });
  if (!segment.departureDate)
    issues.push({ field: f("departureDate"), level: "blocking", message: `${label}: departure date is missing.` });

  if (!segment.airlineName && !segment.airlineCode)
    issues.push({ field: f("airlineName"), level: "warning", message: `${label}: airline is missing.` });
  if (!segment.flightNumber)
    issues.push({ field: f("flightNumber"), level: "warning", message: `${label}: flight number is missing.` });
  if (!segment.departureTime)
    issues.push({ field: f("departureTime"), level: "warning", message: `${label}: departure time is missing.` });
  if (!segment.arrivalTime)
    issues.push({ field: f("arrivalTime"), level: "warning", message: `${label}: arrival time is missing.` });

  checkFormat(issues, f("originCode"), segment.originCode, IATA_CODE, `${label}: airport codes are 3 letters (e.g. LHE).`);
  checkFormat(issues, f("destinationCode"), segment.destinationCode, IATA_CODE, `${label}: airport codes are 3 letters (e.g. DXB).`);
  checkFormat(issues, f("airlineCode"), segment.airlineCode, AIRLINE_CODE, `${label}: airline codes are 2–3 characters (e.g. EK).`);
  checkFormat(issues, f("departureDate"), segment.departureDate, ISO_DATE, `${label}: departure date is not a valid date.`);
  checkFormat(issues, f("arrivalDate"), segment.arrivalDate, ISO_DATE, `${label}: arrival date is not a valid date.`);
  checkFormat(issues, f("departureTime"), segment.departureTime, TIME_24H, `${label}: departure time should look like 14:30.`);
  checkFormat(issues, f("arrivalTime"), segment.arrivalTime, TIME_24H, `${label}: arrival time should look like 14:30.`);

  // Safety net for wrongly assumed years (e.g. a supplier date printed as "14 Mar").
  if (segment.departureDate && ISO_DATE.test(segment.departureDate) && segment.departureDate < today)
    issues.push({ field: f("departureDate"), level: "blocking", message: `${label}: departure date is in the past — check the year.` });
  if (segment.departureDate && segment.arrivalDate && segment.arrivalDate < segment.departureDate)
    issues.push({ field: f("arrivalDate"), level: "blocking", message: `${label}: arrival date is before departure.` });

  return issues;
}

/** Adjacent connecting flights use the same airport's local time, so this check needs no time-zone inference. */
export function reviewFlightSequence(segments: FlightSegment[]): ReviewIssue[] {
  return segments.flatMap((segment, index): ReviewIssue[] => {
    const previous = segments[index - 1];
    if (!previous?.destinationCode || !segment.originCode) return [];
    if (previous.destinationCode !== segment.originCode) return [{
      field: `segments.${index}.originCode`, level: "warning",
      message: `Flight ${index + 1} leaves ${segment.originCode}, but flight ${index} arrives in ${previous.destinationCode}. Check the flight sequence or confirm the separate transfer.`,
    }];
    if (!previous.arrivalDate || !previous.arrivalTime || !segment.departureDate || !segment.departureTime) return [];
    const arrival = `${previous.arrivalDate}T${previous.arrivalTime}`;
    const departure = `${segment.departureDate}T${segment.departureTime}`;
    return departure < arrival ? [{ field: `segments.${index}.departureTime`, level: "blocking",
      message: `Flight ${index + 1} leaves ${segment.originCode} before flight ${index} arrives. Correct the dates, times or flight sequence.` }] : [];
  });
}

export function reviewQuotation(q: Quotation, today: string = localToday()): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  if (q.segments.length === 0)
    issues.push({ field: "segments", level: "blocking", message: "Add at least one flight." });
  q.segments.forEach((s, i) => issues.push(...reviewSegment(s, i, today)));
  issues.push(...reviewFlightSequence(q.segments));

  if (!q.currency)
    issues.push({ field: "currency", level: "blocking", message: "Currency is missing." });
  else checkFormat(issues, "currency", q.currency, CURRENCY_CODE, "Currency should be a 3-letter code (e.g. PKR, USD).");

  if (q.sourceTotal === null)
    issues.push({ field: "sourceTotal", level: "blocking", message: "Supplier price is missing." });

  if (!q.customer.name)
    issues.push({ field: "customer.name", level: "warning", message: "Customer name is empty." });

  for (const flag of q.reviewFlags)
    issues.push({ field: flag.field, level: "warning", message: `Please double-check: ${flag.reason}` });

  return issues;
}

export const hasBlockingIssues = (issues: ReviewIssue[]) => issues.some((i) => i.level === "blocking");

/** Issues grouped by field path for quick lookup by form inputs. */
export function issuesByField(issues: ReviewIssue[]): Map<string, ReviewIssue[]> {
  const map = new Map<string, ReviewIssue[]>();
  for (const issue of issues) map.set(issue.field, [...(map.get(issue.field) ?? []), issue]);
  return map;
}
