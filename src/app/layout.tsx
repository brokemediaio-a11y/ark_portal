import type { Metadata } from "next";
import { Manrope, Public_Sans } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { brand } from "@/config/brand";
import "./globals.css";

const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: `${brand.name} · Portal`, template: `%s · ${brand.name}` },
  description: "Prepare branded flight quotations from supplier documents.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. Grammarly) add attributes to <html>/<body>.
    <html lang="en" className={`${publicSans.variable} ${manrope.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full font-sans" suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
