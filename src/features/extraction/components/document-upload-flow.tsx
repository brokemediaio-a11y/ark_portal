"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { PencilLine, RotateCcw, ScanText, Sparkles, Trash2, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { UPLOAD_MAX_FILES, UPLOAD_MAX_TOTAL_BYTES } from "@/config/upload";
import type { ExtractResponse } from "../schema";
import { useExtraction } from "../use-extraction";
import { ExtractionProgress } from "./extraction-progress";
import { FileDropzone } from "./file-dropzone";
import { FilePreview } from "./file-preview";

type Success<T> = Extract<ExtractResponse<T>, { ok: true }>;

export interface DocumentUploadFlowProps<T> {
  title: string;
  intro: ReactNode;
  /** e.g. "the supplier quotation" — used in buttons and headings. */
  documentLabel: string;
  dropLabel: string;
  endpoint: string;
  /** Saves the result and returns the page to open next. */
  onExtracted: (result: Success<T>, files: File[]) => string;
  /** Creates an empty record and returns the page to open. */
  onManual: () => string;
  manualText: string;
}

const sameFile = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
const MAX_TOTAL_MB = UPLOAD_MAX_TOTAL_BYTES / (1024 * 1024);

/**
 * Upload one or more supplier files, then read them together into ONE record.
 * Nothing is sent until staff press the read button, so they can add every file first.
 */
export function DocumentUploadFlow<T>({ title, intro, documentLabel, dropLabel, endpoint, onExtracted, onManual, manualText }: DocumentUploadFlowProps<T>) {
  const router = useRouter();
  const { state, run, cancel } = useExtraction<T>(endpoint);
  const [files, setFiles] = useState<File[]>([]);
  const [rejection, setRejection] = useState<string | null>(null);

  // Next keeps this page's state when navigating away; returning must offer a new upload.
  useEffect(() => () => {
    setFiles([]);
    setRejection(null);
  }, []);

  const addFile = (file: File) => {
    setRejection(null);
    setFiles((current) => {
      if (current.some((f) => sameFile(f, file))) return current;
      if (current.length >= UPLOAD_MAX_FILES) {
        setRejection(`You can add up to ${UPLOAD_MAX_FILES} files at a time.`);
        return current;
      }
      if (current.reduce((sum, f) => sum + f.size, 0) + file.size > UPLOAD_MAX_TOTAL_BYTES) {
        setRejection(`These files would be over ${MAX_TOTAL_MB} MB together. Please read them in smaller batches.`);
        return current;
      }
      return [...current, file];
    });
  };

  const read = async () => {
    setRejection(null);
    const result = await run(files);
    if (result) router.push(onExtracted(result, files));
  };

  const reset = () => {
    cancel();
    setFiles([]);
    setRejection(null);
  };

  const working = state.status === "working" || state.status === "success";
  const fileCount = `${files.length} file${files.length === 1 ? "" : "s"}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand sm:text-3xl">{title}</h1>
        <p className="mt-1 text-ink-muted">{intro}</p>
      </div>

      <Card>
        <CardHeader
          icon={ScanText}
          title={working ? `Reading ${fileCount}` : `Step 1 — Add ${documentLabel}`}
          description={
            working
              ? "Please wait while we pull out the details. Every value is checked against your files."
              : "PDFs, screenshots or photos. Add several if the details are spread over more than one file."
          }
          actions={working && state.status === "working" ? <Button variant="ghost" size="sm" icon={X} onClick={reset}>Cancel</Button> : undefined}
        />
        <CardBody className="space-y-5">
          {files.length > 0 && (
            <ul className="space-y-2" aria-label="Files to read">
              {files.map((file, i) => (
                <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <FilePreview file={file} />
                  </div>
                  {!working && (
                    <Button
                      variant="danger"
                      size="sm"
                      icon={Trash2}
                      aria-label={`Remove ${file.name}`}
                      title="Remove"
                      onClick={() => setFiles((current) => current.filter((_, j) => j !== i))}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}

          {working ? (
            <ExtractionProgress stage={state.status === "working" ? state.stage : 3} />
          ) : state.status === "error" ? (
            <Alert
              tone="error"
              title="We couldn't fill in the details automatically"
              actions={
                <>
                  {files.length > 0 && state.code !== "invalid_file" && state.code !== "not_configured" && (
                    <Button size="sm" icon={RotateCcw} onClick={read}>Try again</Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={reset}>Start over with other files</Button>
                  <Button size="sm" variant="secondary" icon={PencilLine} onClick={() => router.push(onManual())}>Enter details manually</Button>
                </>
              }
            >
              {state.error}
            </Alert>
          ) : (
            <>
              <FileDropzone onFile={addFile} onReject={setRejection} label={dropLabel} />
              {rejection && <Alert tone="error">{rejection}</Alert>}
              <div className="flex flex-col gap-3 rounded-xl bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink-muted">
                  {files.length === 0
                    ? "Add one or more files above. Nothing is read until you press the button."
                    : `${fileCount} ready. They will be read together into one ${documentLabel.replace(/^the /, "").replace(/^supplier /, "")}.`}
                </p>
                <Button size="lg" icon={Sparkles} disabled={files.length === 0} onClick={read} className="shrink-0">
                  {files.length > 1 ? `Read ${files.length} files` : "Read the details"}
                </Button>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {!working && (
        <section aria-labelledby="no-file-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 id="no-file-heading" className="font-display text-lg font-bold text-brand">Don&apos;t have a file?</h2>
            <p className="mt-0.5 text-sm text-ink-muted">{manualText}</p>
          </div>
          <Button variant="secondary" size="lg" icon={PencilLine} onClick={() => router.push(onManual())} className="shrink-0">
            Type the details in yourself
          </Button>
        </section>
      )}
    </div>
  );
}
