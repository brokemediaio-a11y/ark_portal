import { reviewFlightSequence, reviewSegment, type ReviewIssue } from "@/features/quotation/review";
import { ISO_DATE } from "@/features/quotation/schema";
import { localToday } from "@/lib/dates";
import type { Ticket } from "./schema";

/**
 * What staff must look at before an e-ticket goes to a traveller. Flights follow
 * the quotation rules, except that a past flight is only a warning: staff may
 * reissue a ticket for a journey already under way.
 */
export function reviewTicket(t: Ticket, today: string = localToday()): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  if (!t.passengers.some((p) => p.name))
    issues.push({ field: "passengers", level: "blocking", message: "Add at least one passenger." });
  t.passengers.forEach((p, i) => {
    const label = `Passenger ${i + 1}`;
    if (!p.name) issues.push({ field: `passengers.${i}.name`, level: "blocking", message: `${label}: name is missing.` });
    if (!p.ticketNumber && !Object.keys(p.flightTicketNumbers).length) issues.push({ field: `passengers.${i}.ticketNumber`, level: "warning", message: `${label}: ticket number is missing.` });
    if (p.dateOfBirth && !ISO_DATE.test(p.dateOfBirth))
      issues.push({ field: `passengers.${i}.dateOfBirth`, level: "blocking", message: `${label}: date of birth is not a valid date.` });
  });

  if (!t.bookingReference && !t.segments.some((s) => s.bookingReference)) issues.push({ field: "bookingReference", level: "warning", message: "Booking reference is missing." });

  if (t.segments.length === 0) issues.push({ field: "segments", level: "blocking", message: "Add at least one flight." });
  t.segments.forEach((s, i) =>
    issues.push(
      ...reviewSegment(s, i, today).map((issue) =>
        /in the past/.test(issue.message) ? { ...issue, level: "warning" as const, message: issue.message.replace(" — check the year", "") } : issue,
      ),
    ),
  );

  issues.push(...reviewFlightSequence(t.segments));
  for (const flag of t.reviewFlags) issues.push({ field: flag.field, level: "warning", message: `Please double-check: ${flag.reason}` });
  return issues;
}
