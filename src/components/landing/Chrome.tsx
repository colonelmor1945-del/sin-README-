import Link from "next/link";

import { Brand } from "@/components/Brand";
import { ButtonLink } from "@/components/ui/primitives";

const NAV = [
  { href: "#platform", label: "Platform" },
  { href: "#missions", label: "Intelligence" },
  { href: "#pricing", label: "Pricing" },
  { href: "/fund", label: "Fund the Lab" },
];

/** Sticky navigation. One line at desktop, 64px tall. */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ground/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-6 px-4 sm:px-8">
        <Brand />

        <ul className="hidden items-center gap-7 lg:flex">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="text-[13px] text-ink-muted transition-colors hover:text-ink"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden text-[13px] text-ink-muted transition-colors hover:text-ink sm:block"
          >
            Sign in
          </Link>
          <ButtonLink href="/register" size="sm">
            Start free
          </ButtonLink>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Brand />
            <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-ink-muted">
              An independent intelligence platform for players who would rather
              read the numbers than guess at them.
            </p>
          </div>

          <div>
            <h3 className="text-[13px] font-semibold text-ink">Platform</h3>
            <ul className="mt-3 space-y-2 text-[13px] text-ink-muted">
              <li>
                <Link href="/dashboard" className="hover:text-ink">Dashboard</Link>
              </li>
              <li>
                <Link href="/dashboard/assistant" className="hover:text-ink">AI assistant</Link>
              </li>
              <li>
                <Link href="/dashboard/calculator" className="hover:text-ink">Money calculator</Link>
              </li>
              <li>
                <Link href="/dashboard/missions" className="hover:text-ink">Mission intelligence</Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-[13px] font-semibold text-ink">Project</h3>
            <ul className="mt-3 space-y-2 text-[13px] text-ink-muted">
              <li>
                <Link href="/fund" className="hover:text-ink">Fund the Lab</Link>
              </li>
              <li>
                <Link href="/#pricing" className="hover:text-ink">Pricing</Link>
              </li>
              <li>
                <Link href="/legal" className="hover:text-ink">Legal and data policy</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-line pt-6">
          <p className="max-w-3xl text-[11px] leading-relaxed text-ink-faint">
            GTA 6 Money Lab is an independent fan-made platform and is not
            affiliated with, endorsed by, or associated with Rockstar Games or
            Take-Two Interactive. All trademarks belong to their respective
            owners. Game data shown on this site is placeholder or
            community-reported and is labelled with its confidence level.
          </p>
        </div>
      </div>
    </footer>
  );
}
