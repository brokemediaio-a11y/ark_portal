import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones: Record<string, { box: string; icon: LucideIcon }> = {
  info: { box: "bg-brand-soft border-brand/20 text-brand-ink", icon: Info },
  success: { box: "bg-success-soft border-success/25 text-success-ink", icon: CheckCircle2 },
  warning: { box: "bg-warning-soft border-warning/30 text-warning-ink", icon: AlertTriangle },
  error: { box: "bg-danger-soft border-danger/25 text-danger-ink", icon: XCircle },
};

interface AlertProps {
  tone?: keyof typeof tones;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function Alert({ tone = "info", title, children, actions, className }: AlertProps) {
  const { box, icon: Icon } = tones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border p-4 text-sm", box, className)}>
      <Icon size={20} className="mt-px shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed opacity-90">{children}</div>}
        {actions && <div className="flex flex-wrap gap-2 pt-2">{actions}</div>}
      </div>
    </div>
  );
}
