import { GoogleLogo } from "@phosphor-icons/react/dist/ssr";

/**
 * Google sign-in entry point.
 *
 * A plain link to the server route rather than Google's JS SDK: the SDK loads
 * a third-party script on a page that has not yet asked the visitor for
 * anything, and the redirect flow needs none of it.
 */
export function GoogleButton({ configured }: { configured: boolean }) {
  if (!configured) return null;

  return (
    <>
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11px] text-ink-faint">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <a
        href="/api/auth/google"
        className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-line-strong text-[15px] font-medium text-ink transition-colors hover:border-accent hover:text-accent"
      >
        <GoogleLogo size={18} weight="bold" />
        Continue with Google
      </a>
    </>
  );
}
