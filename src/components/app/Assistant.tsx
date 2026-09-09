"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Stop } from "@phosphor-icons/react/dist/ssr";

import { Button, cx } from "@/components/ui/primitives";
import type { ChatMessage } from "@/lib/types";

const SUGGESTIONS = [
  "I have $2M. What should I buy first?",
  "What is the fastest route to $10 million?",
  "Which mission pays best per hour at my level?",
  "Is the nightclub worth it or should I wait?",
];

type Status = "idle" | "streaming" | "error";

export function Assistant({
  quotaNote,
  providerLabel,
}: {
  quotaNote: string;
  providerLabel: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  // Kept in sync from the response headers so the counter is not stale after
  // the first question. The server remains the authority on the limit.
  const [note, setNote] = useState(quotaNote);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || status === "streaming") return;

    setError(null);
    setInput("");
    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setStatus("streaming");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "The assistant is unavailable right now.");
      }

      const used = Number(response.headers.get("x-queries-used"));
      const rawLimit = response.headers.get("x-queries-limit");
      if (Number.isFinite(used) && rawLimit) {
        setNote(
          rawLimit === "unlimited"
            ? `Running on ${providerLabel}. Answers are AI projections drawn from placeholder data, so check them before you spend.`
            : `${Math.max(0, Number(rawLimit) - used)} of ${rawLimit} free queries left today. Running on ${providerLabel}. Answers are AI projections drawn from placeholder data.`,
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: acc }]);
      }
      setStatus("idle");
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setStatus("idle");
        return;
      }
      setMessages(next);
      setError((e as Error).message);
      setStatus("error");
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-3xl">
          {empty ? (
            <div className="py-10">
              <h2 className="text-lg font-medium text-ink">
                Ask about your route, not the whole game.
              </h2>
              <p className="mt-2 max-w-[60ch] text-[13px] leading-relaxed text-ink-muted">
                The assistant reads your profile before it answers, so questions
                about your own balance and level get a specific reply rather
                than a general guide.
              </p>
              <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => send(s)}
                      className="w-full rounded-[10px] border border-line bg-surface px-4 py-3 text-left text-[13px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ol className="space-y-6">
              {messages.map((m, i) => (
                <li key={i} className={cx(m.role === "user" && "flex justify-end")}>
                  {m.role === "user" ? (
                    <p className="max-w-[85%] rounded-[14px] rounded-br-[4px] bg-accent-dim px-4 py-2.5 text-[14px] text-ink">
                      {m.content}
                    </p>
                  ) : (
                    <div className="text-[14px] leading-relaxed whitespace-pre-wrap text-ink-muted">
                      {m.content || <TypingDots />}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}

          {error ? (
            <p
              role="alert"
              className="mt-6 rounded-[10px] border border-down/40 bg-down/5 px-4 py-3 text-[13px] text-down"
            >
              {error}
            </p>
          ) : null}

          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-line bg-surface px-4 py-4 sm:px-8">
        <form
          className="mx-auto flex max-w-3xl items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <label htmlFor="assistant-input" className="sr-only">
            Ask the assistant
          </label>
          <textarea
            id="assistant-input"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about missions, businesses or your route to the goal"
            className="max-h-40 min-h-[44px] flex-1 resize-none rounded-[10px] border border-line bg-surface-2 px-3.5 py-3 text-[14px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          {status === "streaming" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => abortRef.current?.abort()}
              aria-label="Stop generating"
              className="h-11 w-11 p-0"
            >
              <Stop size={16} weight="fill" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send"
              className="h-11 w-11 p-0"
            >
              <ArrowUp size={17} weight="bold" />
            </Button>
          )}
        </form>
        <p className="mx-auto mt-2.5 max-w-3xl text-[11px] text-ink-faint">{note}</p>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-faint"
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </span>
  );
}
