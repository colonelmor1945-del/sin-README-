import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/AuthForm";
import { Brand } from "@/components/Brand";
import { LaunchCountdown } from "@/components/LaunchCountdown";
import { login } from "@/lib/auth/actions";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-16">
      <div className="grid-field pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute -top-32 left-1/3 h-[420px] w-[420px] rounded-full opacity-35 blur-[130px]"
        style={{ background: "radial-gradient(circle, #4a1044, transparent 70%)" }}
        aria-hidden
      />

      <div className="relative w-full max-w-[400px]">
        <div className="flex justify-center">
          <Brand />
        </div>

        <h1 className="mt-8 text-center text-2xl font-semibold tracking-tight text-ink">
          Welcome back
        </h1>
        <p className="mt-2 mb-8 text-center text-[13px] text-ink-muted">
          Your profile, plans and credits are waiting.
        </p>

        <div className="panel p-6">
          <AuthForm mode="login" action={login} />
        </div>

        <div className="mt-8 flex justify-center">
          <LaunchCountdown variant="compact" />
        </div>
      </div>
    </main>
  );
}
