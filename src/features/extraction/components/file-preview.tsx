"use client";

import { FileText } from "lucide-react";
import { useEffect, useRef } from "react";

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Local-only preview of the chosen file (never leaves the browser for this). */
export function FilePreview({ file }: { file: File }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const isImage = file.type.startsWith("image/");

  useEffect(() => {
    if (!isImage || !imgRef.current) return;
    const objectUrl = URL.createObjectURL(file);
    imgRef.current.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, isImage]);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview
        <img ref={imgRef} alt="" className="size-14 rounded-lg border border-line bg-white object-cover" />
      ) : (
        <span className="grid size-14 place-items-center rounded-lg bg-white text-brand">
          <FileText size={26} aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{file.name}</p>
        <p className="text-xs text-ink-muted">{formatSize(file.size)}</p>
      </div>
    </div>
  );
}
