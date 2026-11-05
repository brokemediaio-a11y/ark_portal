"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";

interface AirlineLogoProps {
  code: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}

/** An airline's logo, falling back to its code in a badge when there is no artwork. */
export function AirlineLogo({ code, name, size = 28, className }: AirlineLogoProps) {
  const [failedCode, setFailedCode] = useState<string | null>(null);
  const box = { width: size, height: size };

  if (!code || failedCode === code) {
    return (
      <span style={box} title={name ?? undefined} className={cn("inline-grid shrink-0 place-items-center rounded-md bg-surface text-[10px] font-bold text-brand", className)}>
        {code ?? "?"}
      </span>
    );
  }
  return (
    <Image
      src={`/api/airlines/${encodeURIComponent(code)}/logo`}
      alt={name ?? code}
      title={name ?? undefined}
      {...box}
      unoptimized
      onError={() => setFailedCode(code)}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
