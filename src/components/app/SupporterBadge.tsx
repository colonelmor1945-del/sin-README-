"use client";

import { useState } from "react";
import { Medal } from "@phosphor-icons/react/dist/ssr";

import { Panel, PanelHead, cx } from "@/components/ui/primitives";
import type { SupporterLevel } from "@/lib/types";

/**
 * Supporter badge visibility.
 *
 * The spec required that a supporter can choose whether their status is public,
 * and the default here is private. That direction matters: a visibility control
 * that defaults to public is not a choice, it is a disclosure the user finds
 * out about afterwards.
 *
 * What a public badge shows is the tier and the display name the user typed.
 * Never an amount, never a date, and never a wallet address. Publishing an
 * address as proof of support would tie a person to an on-chain identity
 * permanently, which is not reversible once done.
 */
const LEVEL_META: Record<SupporterLevel, { label: string; threshold: string }> = {
  supporter: { label: "Supporter", threshold: "Any amount" },
  "early-supporter": { label: "Early supporter", threshold: "25 euro and above" },
  "founding-supporter": { label: "Founding supporter", threshold: "50 euro and above" },
};

export function SupporterBadge({
  level,
  initialPublic = false,
  initialName = "",
  onSave,
}: {
  /** null when this account has not contributed. */
  level: SupporterLevel | null;
  initialPublic?: boolean;
  initialName?: string;
  onSave?: (input: { isPublic: boolean; displayName: string }) => Promise<void>;
}) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [displayName, setDisplayName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!level) {
    return (
      <Panel quiet className="p-5">
        <div className="flex items-center gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-surface-3 text-ink-faint"
            aria-hidden
          >
            <Medal size={19} />
          </span>
          <h2 className="text-[13px] font-semibold text-ink">Supporter badge</h2>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
          Contributions through Fund the Lab earn an optional badge. It is
          private unless you say otherwise, and it never shows an amount.
        </p>
      </Panel>
    );
  }

  const meta = LEVEL_META[level];

  async function save(nextPublic: boolean, nextName: string) {
    if (!onSave) return;
    setSaving(true);
    setSaved(false);
    try {
      await onSave({ isPublic: nextPublic, displayName: nextName });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel>
      <PanelHead
        title="Supporter badge"
        meta={
          <span className="inline-flex items-center gap-1.5 text-[11px] text-accent">
            <Medal size={13} weight="fill" />
            {meta.label}
          </span>
        }
      />

      <div className="space-y-5 p-5">
        <p className="text-[13px] leading-relaxed text-ink-muted">
          You reached <span className="text-ink">{meta.label}</span> at{" "}
          {meta.threshold.toLowerCase()}. Thank you. The badge is yours to show
          or keep to yourself.
        </p>

        <div className="flex items-start gap-3 rounded-[10px] border border-line bg-surface-2 p-4">
          <input
            id="badge-public"
            type="checkbox"
            checked={isPublic}
            disabled={saving}
            onChange={(e) => {
              setIsPublic(e.target.checked);
              save(e.target.checked, displayName);
            }}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
          />
          <div className="min-w-0">
            <label htmlFor="badge-public" className="text-[13px] text-ink">
              Show my badge publicly
            </label>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">
              Off by default. When on, the supporters page shows your chosen name
              and this tier. It never shows how much you gave, when, or any
              wallet address.
            </p>
          </div>
        </div>

        {isPublic ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="badge-name" className="text-[13px] font-medium text-ink">
              Name to show
            </label>
            <input
              id="badge-name"
              value={displayName}
              maxLength={32}
              placeholder="Leave blank to appear as Anonymous"
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={() => save(isPublic, displayName)}
              className="w-full rounded-[10px] border border-line bg-surface-2 px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
            />
            <p className="text-[12px] text-ink-faint">
              Anything you like. It does not have to be your username.
            </p>
          </div>
        ) : null}

        <p
          className={cx(
            "text-[12px] transition-opacity",
            saved ? "text-up opacity-100" : "opacity-0",
          )}
          aria-live="polite"
        >
          Saved.
        </p>
      </div>
    </Panel>
  );
}
