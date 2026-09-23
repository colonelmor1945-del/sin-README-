"use client";

import { ArrowClockwise, ArrowLeft, Warning } from "@phosphor-icons/react";
import { useEffect } from "react";

import { Brand } from "@/components/Brand";
import { Button, ButtonLink, Panel } from "@/components/ui/primitives";

/**
 * What a server error looks like.
 *
 * Without this file the answer is Next's own screen: "Application error: a
 * server-side exception has occurred while loading localhost" over a bare
 * white page, with a digest and nothing else. That is what this app showed
 * every time `getStore()` returned undefined -- which was every signed-in page
 * for as long as a database was configured.
 *
 * Two rules it follows, both from the way the rest of the product works.
 *
 * It does not explain what went wrong, because it does not know. A friendly
 * guess printed next to a real failure is the same mistake as an unlabelled
 * number: it reads as information and is not one.
 *
 * And it keeps the digest visible. It is the only thing that ties what
 * somebody saw to the line in the log that caused it, and hiding it to look
 * tidier means the report that follows is "it broke" with nothing attached.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The server has already logged it. This is the browser's copy, so a
    // report can be reconstructed from a screenshot of the console alone.
    console.error("[app] render failed", error);
  }, [error]);

  return (
    <div className="grid min-h-[100dvh] place-items-center px-4 py-10">
      <div className="w-full max-w-[52ch]">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>

        <Panel className="p-8 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-down/40 text-down">
            <Warning size={18} />
          </span>

          <h1 className="mt-5 text-[19px] font-semibold tracking-tight text-ink">
            This page did not load
          </h1>
          <p className="mx-auto mt-2 max-w-[44ch] text-[13px] leading-relaxed text-ink-muted">
            Something failed on our side. Your account, your plans and your
            credits are untouched by it, and trying again often works, since
            most of these are momentary.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
            <Button size="sm" onClick={reset}>
              <ArrowClockwise size={14} />
              Try again
            </Button>
            <ButtonLink href="/dashboard" variant="outline" size="sm">
              <ArrowLeft size={14} />
              Back to the dashboard
            </ButtonLink>
          </div>
        </Panel>

        {error.digest ? (
          <p className="mt-5 text-center text-[12px] leading-relaxed text-ink-faint">
            If you report this, include{" "}
            <code className="rounded-[4px] border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">
              {error.digest}
            </code>
            <br />
            It is what lets us find this exact failure in the logs.
          </p>
        ) : null}
      </div>
    </div>
  );
}
