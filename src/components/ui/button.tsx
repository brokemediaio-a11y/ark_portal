import Link from "next/link";
import { Loader2, type LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-brand text-white hover:bg-brand-strong shadow-sm",
  accent: "bg-accent text-brand-ink hover:brightness-95 shadow-sm",
  secondary: "bg-white text-ink border border-line hover:bg-surface",
  ghost: "text-ink-muted hover:bg-surface hover:text-ink",
  danger: "text-danger hover:bg-danger-soft",
} as const;

const sizes = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-13 px-6 text-base gap-2.5",
} as const;

interface StyleProps {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
}

export function buttonClasses({ variant = "primary", size = "md" }: StyleProps, className?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-xl font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
    variants[variant],
    sizes[size],
    className,
  );
}

const iconSize = (size: StyleProps["size"]) => (size === "lg" ? 20 : size === "sm" ? 16 : 18);

type ButtonProps = ComponentProps<"button"> & StyleProps & { loading?: boolean };

export function Button({
  variant,
  size,
  icon: Icon,
  iconRight: IconRight,
  loading,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <Loader2 size={iconSize(size)} className="animate-spin" aria-hidden />
      ) : (
        Icon && <Icon size={iconSize(size)} aria-hidden />
      )}
      {children}
      {IconRight && <IconRight size={iconSize(size)} aria-hidden />}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & StyleProps;

export function ButtonLink({ variant, size, icon: Icon, iconRight: IconRight, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size }, className)} {...props}>
      {Icon && <Icon size={iconSize(size)} aria-hidden />}
      {children}
      {IconRight && <IconRight size={iconSize(size)} aria-hidden />}
    </Link>
  );
}
