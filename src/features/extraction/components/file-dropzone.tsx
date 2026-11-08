"use client";

import { ClipboardPaste, FileText, FolderOpen, ImageIcon, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { ACCEPTED_EXTENSIONS, ACCEPTED_FILES_LABEL } from "@/config/upload";
import { cn } from "@/lib/cn";
import { checkFileBasics } from "../file-validation";

interface FileDropzoneProps {
  /** Called with each accepted file; several can be dropped or chosen at once. */
  onFile: (file: File) => void;
  onReject: (message: string) => void;
  disabled?: boolean;
  label?: string;
}

/** Drag & drop, browse, or paste screenshots (Ctrl/⌘+V) anywhere on the page. One or many files. */
export function FileDropzone({ onFile, onReject, disabled, label = "Drag the supplier documents here" }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (file: File | null | undefined) => {
    if (!file || disabled) return;
    const check = checkFileBasics(file.name, file.size);
    if (!check.ok) return onReject(check.error);
    onFile(file);
  };
  const acceptRef = useRef(accept);
  useEffect(() => {
    acceptRef.current = accept;
  });

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.kind === "file");
      const blob = item?.getAsFile();
      if (!blob) return;
      e.preventDefault();
      const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
      const name = blob.name && blob.name !== "image.png" ? blob.name : `screenshot-${new Date().toTimeString().slice(0, 8).replace(/:/g, "")}.${ext}`;
      acceptRef.current(new File([blob], name, { type: blob.type }));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    Array.from(e.dataTransfer.files ?? []).forEach(accept);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors sm:py-16",
        dragging ? "border-brand bg-brand-soft" : "border-line bg-white hover:border-brand/40",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <span className={cn("mb-4 grid size-16 place-items-center rounded-2xl transition-colors", dragging ? "bg-brand text-white" : "bg-brand-soft text-brand")}>
        <UploadCloud size={30} aria-hidden />
      </span>
      <p className="text-lg font-semibold text-ink">
        {dragging ? "Drop the files here" : label}
      </p>
      <p className="mt-1 text-sm text-ink-muted">or pick them from your computer. Add as many as you need, then read them together.</p>
      <Button size="lg" icon={FolderOpen} className="mt-5" onClick={() => inputRef.current?.click()}>
        Choose files
      </Button>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5"><FileText size={14} /> PDF</span>
        <span className="inline-flex items-center gap-1.5"><ImageIcon size={14} /> Screenshot / photo</span>
        <span className="inline-flex items-center gap-1.5">
          <ClipboardPaste size={14} /> Or paste a screenshot with <kbd className="rounded border border-line bg-surface px-1 font-sans">Ctrl</kbd>+<kbd className="rounded border border-line bg-surface px-1 font-sans">V</kbd>
        </span>
      </div>
      <p className="mt-3 text-xs text-ink-faint">{ACCEPTED_FILES_LABEL}</p>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        multiple
        accept={ACCEPTED_EXTENSIONS.join(",")}
        onChange={(e) => {
          Array.from(e.target.files ?? []).forEach(accept);
          e.target.value = "";
        }}
      />
    </div>
  );
}
