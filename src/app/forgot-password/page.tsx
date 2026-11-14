import Link from "next/link";
import { AuthForm } from "@/features/auth/auth-form";

export default function ForgotPasswordPage() {
  return <main className="grid min-h-screen place-items-center bg-canvas px-4 py-12"><section className="w-full max-w-md space-y-6 rounded-2xl border border-line bg-white p-8">
    <h1 className="text-2xl font-bold text-brand">Forgot password?</h1>
    <p className="text-sm text-ink-muted">Enter your account email. The development team will receive your request and help you recover access after verifying your identity.</p>
    <AuthForm mode="forgot-password" />
    <Link href="/login" className="block text-center text-sm text-brand underline">Back to sign in</Link>
  </section></main>;
}
