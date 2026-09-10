import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

/**
 * What the installed app shows when the network is gone.
 *
 * It deliberately does not show any figures. The service worker could have
 * kept the last mission table around and rendered it here, and that would look
 * more impressive and be worse: this platform's argument is that every number
 * it shows is current and labelled, and a payout served from a cache with no
 * date on it is exactly the confident-but-unverified thing the whole
 * provenance system exists to prevent.
 *
 * So the honest offline state is to say what is missing and how to get it back.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-[42rem] flex-col justify-center px-6 py-16">
      <p className="text-[11px] font-medium tracking-[0.18em] text-ink-faint uppercase">
        No connection
      </p>

      <h1 className="mt-4 text-3xl leading-tight font-semibold tracking-tight text-ink sm:text-4xl">
        You are offline.
      </h1>

      <p className="mt-4 max-w-[52ch] text-[14px] leading-relaxed text-ink-muted">
        Money Lab does not keep figures on your device. Payouts, prices and
        payback periods change, and a number shown without knowing how old it is
        would be worse than no number at all.
      </p>

      <p className="mt-3 max-w-[52ch] text-[14px] leading-relaxed text-ink-muted">
        Reconnect and everything comes straight back.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/">Try again</ButtonLink>
      </div>
    </main>
  );
}
