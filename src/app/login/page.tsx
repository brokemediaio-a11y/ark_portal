import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Image from "next/image";
import { brand } from "@/config/brand";
import { currentUser, hasAdmin } from "@/features/auth/server";
import { AuthForm } from "@/features/auth/auth-form";

async function Login() {
  await connection();
  const user = await currentUser();
  if (user) redirect(user.mustChangePassword ? "/change-password" : "/");
  const setup = !hasAdmin();
  return (
    <main className="relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden bg-[#f3f5f7] px-4 py-10 sm:py-14">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_15%_15%,#dce4ec_0%,transparent_50%),radial-gradient(ellipse_at_90%_90%,#f5ecde_0%,transparent_45%)]" />
      <svg aria-hidden viewBox="0 0 900 900" fill="none" className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[min(140vw,1000px)] -translate-1/2 text-brand/[0.06]">
        <circle cx="450" cy="450" r="370" stroke="currentColor" />
        <circle cx="450" cy="450" r="290" stroke="currentColor" strokeDasharray="3 9" />
        <path d="M85 520C220 120 650 110 820 400M140 690C380 770 720 600 790 220" stroke="currentColor" strokeDasharray="4 8" />
      </svg>

      <section aria-labelledby="login-heading" className="w-full max-w-[440px] overflow-hidden rounded-[24px] border border-white bg-white shadow-[0_24px_80px_-24px_rgba(31,48,67,0.24),0_2px_8px_rgba(31,48,67,0.04)]">
        <div className="relative flex flex-col items-center overflow-hidden bg-brand px-8 pt-7 pb-6 text-center">
          <div aria-hidden className="absolute -top-20 -right-16 size-56 rounded-full border border-white/[0.06]" />
          <div aria-hidden className="absolute -bottom-28 -left-12 size-56 rounded-full border border-white/[0.06]" />
          <Image src={brand.pdfLogoPath} alt={brand.name} width={930} height={800} preload className="relative h-auto w-[108px]" />
          <p className="mt-4 text-[10px] font-semibold tracking-[0.24em] text-white/70 uppercase">Staff portal</p>
        </div>

        <div className="px-6 pt-7 pb-7 sm:px-9 sm:pt-8">
          <div className="mb-7 text-center">
            <span aria-hidden className="mx-auto mb-4 block h-0.5 w-8 rounded-full bg-accent" />
            <h1 id="login-heading" className="text-[26px] font-extrabold tracking-tight text-brand">{setup ? "Let’s get you started" : "Welcome back"}</h1>
            <p className="mx-auto mt-2 max-w-[300px] text-sm leading-relaxed text-ink-muted">
              {setup ? "Create your administrator account to set up your team’s workspace." : "Sign in to your Ark Travelers workspace."}
            </p>
          </div>
          <AuthForm mode={setup ? "setup" : "login"} />
        </div>
      </section>

      <footer className="mt-6 space-y-1 text-center text-xs leading-relaxed text-ink-faint">
        <p className="font-medium text-ink-muted">{brand.tagline}</p>
        <p>© {new Date().getFullYear()} {brand.legalName}</p>
      </footer>
    </main>
  );
}
export default function LoginPage() { return <Suspense fallback={<p className="p-8">Loading…</p>}><Login /></Suspense>; }
