import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketLoader } from "@/features/ticket/components/ticket-loader";

export const metadata: Metadata = { title: "Edit e-ticket" };

export default function TicketPage() {
  return (
    <Suspense>
      <TicketLoader />
    </Suspense>
  );
}
