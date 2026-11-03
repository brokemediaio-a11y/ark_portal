import { Badge } from "@/components/ui/badge";
import type { QuotationStatus } from "../schema";

const STATUS: Record<QuotationStatus, { label: string; tone: "neutral" | "brand" | "success" | "warning" }> = {
  draft: { label: "Draft", tone: "warning" },
  ready: { label: "PDF ready", tone: "brand" },
  sent: { label: "Sent", tone: "success" },
  archived: { label: "Archived", tone: "neutral" },
};

export function StatusBadge({ status }: { status: QuotationStatus }) {
  const { label, tone } = STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
