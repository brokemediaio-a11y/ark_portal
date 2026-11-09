import type { Metadata } from "next";
import { UploadQuotationFlow } from "@/features/extraction/components/upload-quotation-flow";

export const metadata: Metadata = { title: "New quotation" };

export default function NewQuotationPage() {
  return <UploadQuotationFlow />;
}
