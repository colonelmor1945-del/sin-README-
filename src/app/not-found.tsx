import { ArrowLeft, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { Brand } from "@/components/Brand";
import { ButtonLink, Panel } from "@/components/ui/primitives";

export const metadata = { title: "Not found" };

/**
 * The 404.
 *
 * Next's default is a bare black page with "404 | This page could not be
 * found" and no way out: no wordmark, no navigation, nothing to click. A
 * mistyped URL or a stale link therefore ended the visit.
 *
 * This one is a dead end too -- the page really is not there and pretending
 * otherwise would be worse -- but it is a dead end with exits, and it looks
 * like the rest of the product rather than like the framework underneath it.
 */
export default function NotFound() {
  return (
    <div className="grid min-h-[100dvh] place-items-center px-4 py-10">
      <div className="w-full max-w-[52ch]">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>

        <Panel className="p-8 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-line text-ink-faint">
            <MagnifyingGlass size={18} />
          </span>

          <h1 className="mt-5 text-[19px] font-semibold tracking-tight text-ink">
            That page is not here
          </h1>
          <p className="mx-auto mt-2 max-w-[42ch] text-[13px] leading-relaxed text-ink-muted">
            The address may be mistyped, or it pointed at something that has
            since been renamed. Nothing is wrong on your end.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
            <ButtonLink href="/dashboard" size="sm">
              <ArrowLeft size={14} />
              Back to the dashboard
            </ButtonLink>
            <ButtonLink href="/" variant="outline" size="sm">
              Home
            </ButtonLink>
          </div>
        </Panel>

        <p className="mt-5 text-center text-[12px] text-ink-faint">
          Looking for something specific? Try{" "}
          <Link href="/dashboard/missions" className="text-ink-muted underline underline-offset-2 hover:text-accent">
            missions
          </Link>
          ,{" "}
          <Link href="/dashboard/map" className="text-ink-muted underline underline-offset-2 hover:text-accent">
            the map
          </Link>{" "}
          or{" "}
          <Link href="/dashboard/economy" className="text-ink-muted underline underline-offset-2 hover:text-accent">
            the economy tracker
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
