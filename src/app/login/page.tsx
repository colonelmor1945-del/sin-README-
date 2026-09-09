import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/AuthForm";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Brand } from "@/components/Brand";
import { LaunchCountdown } from "@/components/LaunchCountdown";
import { login } from "@/lib/auth/actions";
import { googleConfigured } from "@/lib/auth/google";
import { getSession } from "@/lib/auth/session";

const OAUTH_ERRORS: Record<string, string> = {
  "google-unconfigured": "Google sign-in is not configured on this deployment.",
  cancelled: "Sign-in was cancelled.",
  "state-mismatch": "That sign-in link expired. Try again.",
  "bad-callback": "Google sent back an incomplete response. Try again.",
  "google-failed": "Google sign-in failed. Try again, or use your password.",
  "rate-limited": "Too many attempts. Wait a moment.",
};

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSession()) redirect("/dashboard");
  const { error } = await searchParams;
  const message = error ? OAUTH_ERRORS[error] : null;

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

        <div className="panel space-y-5 p-6">
          {message ? (
            <p
              role="alert"
              className="rounded-[10px] border border-down/40 bg-down/5 px-3.5 py-2.5 text-[13px] text-down"
            >
              {message}
            </p>
          ) : null}

          <AuthForm mode="login" action={login} />
          <GoogleButton configured={googleConfigured()} />
        </div>

        <div className="mt-8 flex justify-center">
          <LaunchCountdown variant="compact" />
        </div>
      </div>
    </main>
  );
}
