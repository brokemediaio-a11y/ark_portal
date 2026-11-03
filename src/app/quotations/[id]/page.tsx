import type { Metadata } from "next";
import { Suspense } from "react";
import { QuotationLoader } from "@/features/quotation/components/quotation-loader";

export const metadata: Metadata = { title: "Edit quotation" };

export default function QuotationPage() {
  return (
    <Suspense>
      <QuotationLoader />
    </Suspense>
  );
}
