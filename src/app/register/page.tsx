import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/AuthForm";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Brand } from "@/components/Brand";
import { register } from "@/lib/auth/actions";
import { googleConfigured } from "@/lib/auth/google";
import { getSession } from "@/lib/auth/session";
import { SIGNUP_CREDITS } from "@/lib/db/store";

export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-16">
      <div className="grid-field pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute -top-32 right-1/3 h-[420px] w-[420px] rounded-full opacity-35 blur-[130px]"
        style={{ background: "radial-gradient(circle, #4a1044, transparent 70%)" }}
        aria-hidden
      />

      <div className="relative w-full max-w-[400px]">
        <div className="flex justify-center">
          <Brand />
        </div>

        <h1 className="mt-8 text-center text-2xl font-semibold tracking-tight text-ink">
          Start free
        </h1>
        <p className="mt-2 mb-8 text-center text-[13px] text-ink-muted">
          Five AI queries a day and {SIGNUP_CREDITS} Lab Credits to begin. No card.
        </p>

        <div className="panel space-y-5 p-6">
          <AuthForm mode="register" action={register} />
          <GoogleButton configured={googleConfigured()} />
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-ink-faint">
          An independent fan-made platform, not affiliated with Rockstar Games
          or Take-Two Interactive.
        </p>
      </div>
    </main>
  );
}
