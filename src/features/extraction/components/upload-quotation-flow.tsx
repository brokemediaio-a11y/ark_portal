"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PencilLine, RotateCcw, ScanText, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createEmptyQuotation, quotationFromExtraction } from "@/features/quotation/factory";
import { quotationStore } from "@/features/quotation/storage";
import { useExtraction } from "../use-extraction";
import { ExtractionProgress } from "./extraction-progress";
import { FileDropzone } from "./file-dropzone";
import { FilePreview } from "./file-preview";

export function UploadQuotationFlow() {
  const router = useRouter();
  const { state, run, cancel } = useExtraction();
  const [file, setFile] = useState<File | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  const start = async (chosen: File) => {
    setRejection(null);
    setFile(chosen);
    const result = await run(chosen);
    if (!result) return;
    const quotation = quotationFromExtraction(result.data, { fileName: chosen.name, demo: result.demo });
    quotationStore.save(quotation);
    router.push(`/quotations/${quotation.id}`);
  };

  // Next keeps this page's state when navigating away; returning must offer a new upload.
  useEffect(() => () => {
    setFile(null);
    setRejection(null);
  }, []);

  const startManually = () => {
    const quotation = createEmptyQuotation("manual");
    quotationStore.save(quotation);
    router.push(`/quotations/${quotation.id}`);
  };

  const reset = () => {
    cancel();
    setFile(null);
    setRejection(null);
  };

  const working = state.status === "working" || state.status === "success";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand sm:text-3xl">Create a quotation</h1>
        <p className="mt-1 text-ink-muted">
          Upload the supplier&apos;s quotation and we&apos;ll fill in the flight details for you. You&apos;ll be able to check and change everything before anything is sent.
        </p>
      </div>

      <Card>
        <CardHeader
          icon={ScanText}
          title={working ? "Reading your document" : "Step 1 — Add the supplier document"}
          description={working ? "Please wait while we pull out the flight details." : "A PDF, a screenshot, or a photo of the quotation."}
          actions={
            working && state.status === "working" ? (
              <Button variant="ghost" size="sm" icon={X} onClick={reset}>Cancel</Button>
            ) : undefined
          }
        />
        <CardBody className="space-y-5">
          {file && (working || state.status === "error") && <FilePreview file={file} />}

          {working ? (
            <ExtractionProgress stage={state.status === "working" ? state.stage : 3} />
          ) : state.status === "error" ? (
            <Alert
              tone="error"
              title="We couldn't fill in the details automatically"
              actions={
                <>
                  {file && state.code !== "invalid_file" && state.code !== "not_configured" && (
                    <Button size="sm" icon={RotateCcw} onClick={() => start(file)}>Try again</Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={reset}>Choose a different file</Button>
                  <Button size="sm" variant="secondary" icon={PencilLine} onClick={startManually}>Enter details manually</Button>
                </>
              }
            >
              {state.error}
            </Alert>
          ) : (
            <>
              <FileDropzone onFile={start} onReject={setRejection} />
              {rejection && <Alert tone="error">{rejection}</Alert>}
            </>
          )}
        </CardBody>
      </Card>

      {!working && (
        <section aria-labelledby="no-file-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 id="no-file-heading" className="font-display text-lg font-bold text-brand">Don&apos;t have a file?</h2>
            <p className="mt-0.5 text-sm text-ink-muted">You can still make a quotation. Type in the flights and price yourself.</p>
          </div>
          <Button variant="secondary" size="lg" icon={PencilLine} onClick={startManually} className="shrink-0">
            Type the details in yourself
          </Button>
        </section>
      )}
    </div>
  );
}
