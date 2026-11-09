"use client";

import { useParams } from "next/navigation";
import { FileQuestion, Loader2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { useTicketMap } from "../storage";
import { TicketWorkspace } from "./ticket-workspace";

export function TicketLoader() {
  const { id } = useParams<{ id: string }>();
  const { records: map, error, retry } = useTicketMap();

  if (error) return <div role="alert" className="space-y-3 p-6"><p>{error}</p><button onClick={retry} className="text-brand underline">Try again</button></div>;

  if (!map) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-ink-muted">
        <Loader2 className="animate-spin" aria-label="Loading e-ticket" />
      </div>
    );
  }

  const ticket = Object.hasOwn(map, id) ? map[id] : undefined;
  if (!ticket) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <FileQuestion size={40} className="mx-auto text-ink-faint" />
        <h1 className="text-xl font-semibold text-ink">E-ticket not found</h1>
        <p className="text-sm text-ink-muted">
          It may have been deleted, or your account does not have access to it.
        </p>
        <ButtonLink href="/tickets">Back to my tickets</ButtonLink>
      </div>
    );
  }

  // Keyed by id so switching tickets resets editor state; the editor owns it after first load.
  return <TicketWorkspace key={ticket.id} initial={ticket} />;
}
