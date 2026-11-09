import type { Metadata } from "next";
import { UploadTicketFlow } from "@/features/ticket/components/upload-ticket-flow";

export const metadata: Metadata = { title: "Convert a ticket" };

export default function NewTicketPage() {
  return <UploadTicketFlow />;
}
