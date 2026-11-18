import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brand } from "@/config/brand";
import { CallRedirect } from "./call-redirect";

/**
 * /call/46700101401 opens the phone app with that number. The PDFs link here because many Android PDF viewers only
 * open web links, not "tel:" links. Only Ark Travelers' own numbers have a page, so it can't dial anything else.
 */
const PHONES = new Map(brand.contact.phones.map((phone) => [phone.replace(/\D/g, ""), phone]));

export function generateStaticParams() {
  return [...PHONES.keys()].map((number) => ({ number }));
}

export const metadata: Metadata = { title: `Call ${brand.name}`, robots: { index: false, follow: false } };

export default async function CallPage({ params }: PageProps<"/call/[number]">) {
  const { number } = await params;
  const phone = PHONES.get(number);
  if (!phone) notFound();
  return (
    <main className="flex min-h-svh items-center justify-center bg-[#f3f5f7] px-4">
      <section className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-[0_24px_80px_-24px_rgba(31,48,67,0.24)]">
        <p className="text-xs font-semibold tracking-[0.2em] text-ink-muted uppercase">{brand.legalName}</p>
        <h1 className="mt-3 text-xl font-semibold text-ink">Opening your phone app…</h1>
        <CallRedirect phone={phone} href={`tel:+${number}`} />
      </section>
    </main>
  );
}
