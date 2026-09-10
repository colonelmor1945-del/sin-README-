"use client";

import { useState } from "react";

import { ProvenanceTag } from "@/components/ProvenanceTag";
import { Button, Panel, PanelHead, Skeleton } from "@/components/ui/primitives";
import type { CreatorIdea } from "@/lib/types";

export function CreatorLab({
  seeded,
  credits,
  cost,
}: {
  seeded: CreatorIdea[];
  credits: number;
  cost: number;
}) {
  const [topic, setTopic] = useState("");
  const [idea, setIdea] = useState<CreatorIdea | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState(credits);

  async function generate(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 3 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/creator", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: trimmed }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Generation failed.");
      setIdea(body.idea);
      setBalance(body.creditsRemaining);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Panel className="p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              generate(topic);
            }}
          >
            <label htmlFor="topic" className="text-[13px] font-medium text-ink">
              Topic
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Which business to buy first"
                className="min-w-[240px] flex-1 rounded-[10px] border border-line bg-surface-2 px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
              />
              <Button type="submit" disabled={loading || topic.trim().length < 3}>
                {loading ? "Generating" : "Generate package"}
              </Button>
            </div>
            <p className="mt-2 text-[12px] text-ink-faint">
              Costs {cost} Lab Credits. You have{" "}
              <span className="tabular text-ink-muted">{balance}</span>. You get
              titles, a hook, a thumbnail concept and search keywords.
            </p>
            {error ? (
              <p role="alert" className="mt-3 text-[13px] text-down">
                {error}
              </p>
            ) : null}
          </form>
        </Panel>

        {loading ? (
          <Panel className="space-y-3 p-5">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </Panel>
        ) : null}

        {!loading && idea ? <IdeaCard idea={idea} /> : null}

        {!loading && !idea ? (
          <Panel>
            <PanelHead title="Trending topics" />
            <ul className="divide-y divide-line/70">
              {seeded.map((s) => (
                <li key={s.topic} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-ink">{s.topic}</p>
                    <p className="mt-0.5 text-[12px] text-ink-faint">{s.angle}</p>
                  </div>
                  <span className="tabular shrink-0 text-[13px] text-accent">
                    +{s.momentum}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setTopic(s.topic);
                      generate(s.topic);
                    }}
                  >
                    Use
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>

      <Panel quiet className="h-fit p-5">
        <h2 className="text-[13px] font-semibold text-ink">Momentum index</h2>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
          The momentum figures on the seeded topics are a fictional demo index,
          not real search volume. Wire this to a trends source before you plan a
          content calendar around it.
        </p>
        <h3 className="mt-5 border-t border-line pt-4 text-[13px] font-semibold text-ink">
          House rule
        </h3>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
          Titles are written to claim something the video can actually deliver.
          A title that promises a number should be backed by the calculator
          before you publish it.
        </p>
      </Panel>
    </div>
  );
}

function IdeaCard({ idea }: { idea: CreatorIdea }) {
  return (
    <Panel>
      <PanelHead
        title={idea.topic}
        meta={<ProvenanceTag value={idea.provenance} size="xs" />}
      />
      <div className="space-y-6 p-5">
        <Block label="Opening hook">
          <p className="text-[15px] leading-relaxed text-ink italic">
            &ldquo;{idea.hook}&rdquo;
          </p>
        </Block>

        <Block label="Titles">
          <ul className="space-y-2">
            {idea.titles.map((t, i) => (
              <li key={t} className="flex gap-3 text-[14px] text-ink-muted">
                <span className="tabular text-ink-faint">{i + 1}</span>
                {t}
              </li>
            ))}
          </ul>
        </Block>

        <Block label={`Script, ${formatRuntime(idea.runtimeSeconds)}`}>
          <ol className="divide-y divide-line/70 overflow-hidden rounded-[10px] border border-line">
            {idea.script.map((beat) => (
              <li key={beat.at} className="bg-surface-2 p-3.5">
                <div className="flex items-baseline gap-3">
                  <span className="tabular shrink-0 text-[11px] text-accent">
                    {formatRuntime(beat.at)}
                  </span>
                  <span className="text-[11px] text-ink-faint">{beat.label}</span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-ink">
                  {beat.narration}
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-ink-faint">
                  On screen: {beat.onScreen}
                </p>
              </li>
            ))}
          </ol>
          <CopyScript idea={idea} />
        </Block>

        <Block label="Thumbnail concept">
          <p className="text-[13px] leading-relaxed text-ink-muted">
            {idea.thumbnailConcept}
          </p>
        </Block>

        <Block label="Angle">
          <p className="text-[13px] leading-relaxed text-ink-muted">{idea.angle}</p>
        </Block>

        <Block label="Search keywords">
          <div className="flex flex-wrap gap-1.5">
            {idea.seoKeywords.map((k) => (
              <span
                key={k}
                className="rounded-full border border-line px-2.5 py-1 text-[12px] text-ink-muted"
              >
                {k}
              </span>
            ))}
          </div>
        </Block>
      </div>
    </Panel>
  );
}

/** 95 becomes "1:35". Timestamps read as timestamps, not as raw seconds. */
function formatRuntime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * Copies the script as plain text.
 *
 * Creators paste this into a teleprompter or a doc, so the clipboard format
 * is the narration with its timestamps, not the JSON behind it.
 */
function CopyScript({ idea }: { idea: CreatorIdea }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = [
      idea.topic,
      "",
      ...idea.script.flatMap((beat) => [
        `[${formatRuntime(beat.at)}] ${beat.label}`,
        beat.narration,
        `On screen: ${beat.onScreen}`,
        "",
      ]),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused. Saying so beats a button that
      // silently does nothing.
      setCopied(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={copy} className="mt-3">
      {copied ? "Copied" : "Copy script"}
    </Button>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-medium text-ink-faint">{label}</h3>
      {children}
    </div>
  );
}
