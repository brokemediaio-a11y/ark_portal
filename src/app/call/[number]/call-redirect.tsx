"use client";

import { Phone } from "lucide-react";
import { useEffect } from "react";

/**
 * Opens the phone app as soon as the page loads. Some browsers only allow that after a tap, so the number is also
 * shown as a large button.
 */
export function CallRedirect({ phone, href }: { phone: string; href: string }) {
  useEffect(() => {
    window.location.href = href;
  }, [href]);

  return (
    <a href={href} className="mt-6 inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-brand px-6 text-lg font-semibold text-white shadow-sm">
      <Phone size={22} aria-hidden /> Call {phone}
    </a>
  );
}
