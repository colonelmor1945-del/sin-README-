"use client";

import { useMemo, useState } from "react";

import { ProvenanceTag } from "@/components/ProvenanceTag";
import { Panel, cx } from "@/components/ui/primitives";
import { moneyShort } from "@/lib/format";
import { PIN_KINDS } from "@/lib/data/map";
import type { MapPin, PinKind } from "@/lib/types";

/**
 * Interactive intelligence map.
 *
 * The landmass is drawn as a stylised abstract shape rather than traced from a
 * Rockstar map asset. Pins are positioned as percentages, so new verified
 * locations only need x and y values to appear here.
 */
const KIND_COLOR: Record<PinKind, string> = {
  mission: "var(--color-accent)",
  business: "var(--color-up)",
  property: "var(--color-projection)",
  "money-spot": "#ffb020",
  vehicle: "var(--color-ink-muted)",
  activity: "var(--color-accent-soft)",
};

export function IntelMap({
  pins,
  lockedKinds,
}: {
  pins: MapPin[];
  lockedKinds: PinKind[];
}) {
  const [active, setActive] = useState<Set<PinKind>>(
    new Set(PIN_KINDS.map((k) => k.id).filter((k) => !lockedKinds.includes(k))),
  );
  const [selected, setSelected] = useState<MapPin | null>(null);

  const visible = useMemo(
    () => pins.filter((p) => active.has(p.kind) && !lockedKinds.includes(p.kind)),
    [pins, active, lockedKinds],
  );

  function toggle(kind: PinKind) {
    if (lockedKinds.includes(kind)) return;
    const next = new Set(active);
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    setActive(next);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Panel className="overflow-hidden">
        {/* Filters */}
        <div className="flex flex-wrap gap-1.5 border-b border-line p-3">
          {PIN_KINDS.map(({ id, label }) => {
            const locked = lockedKinds.includes(id);
            const on = active.has(id) && !locked;
            const count = pins.filter((p) => p.kind === id).length;
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                disabled={locked}
                aria-pressed={on}
                title={locked ? "Available on Pro and Elite" : undefined}
                className={cx(
                  "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                  locked
                    ? "cursor-not-allowed border-line text-ink-faint opacity-50"
                    : on
                      ? "border-line-strong bg-surface-2 text-ink"
                      : "border-line text-ink-faint hover:text-ink-muted",
                )}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: on ? KIND_COLOR[id] : "var(--color-line-strong)" }}
                  aria-hidden
                />
                {label}
                <span className="tabular text-[10px] text-ink-faint">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Canvas */}
        <div className="relative aspect-[4/3] w-full bg-[#070510]">
          <div className="grid-field absolute inset-0" aria-hidden />

          <svg
            viewBox="0 0 100 75"
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
            aria-hidden
          >
            {/* Stylised landmass. Abstract, not traced from a game asset. */}
            <path
              d="M14 10 L52 6 L76 12 L86 26 L82 44 L70 58 L58 68 L40 70 L24 60 L16 44 Z"
              fill="rgb(255 255 255 / 0.025)"
              stroke="var(--color-line-strong)"
              strokeWidth="0.3"
            />
            <path
              d="M52 62 L68 70 L60 74 L48 71 Z"
              fill="rgb(255 255 255 / 0.02)"
              stroke="var(--color-line-strong)"
              strokeWidth="0.3"
            />
            <path
              d="M20 34 L44 30 L48 42 L30 50 Z"
              fill="rgb(255 255 255 / 0.015)"
              stroke="var(--color-line)"
              strokeWidth="0.2"
            />
          </svg>

          {visible.map((pin) => {
            const isSelected = selected?.id === pin.id;
            return (
              <button
                key={pin.id}
                type="button"
                onClick={() => setSelected(isSelected ? null : pin)}
                aria-label={`${pin.name}, ${pin.region}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-1.5 transition-transform hover:scale-125 focus-visible:scale-125"
                style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
              >
                <span
                  className={cx(
                    "block rounded-full transition-all",
                    isSelected ? "h-3 w-3 ring-2 ring-white/50" : "h-2 w-2",
                  )}
                  style={{ background: KIND_COLOR[pin.kind] }}
                />
              </button>
            );
          })}

          {visible.length === 0 ? (
            <p className="absolute inset-0 grid place-items-center text-[13px] text-ink-faint">
              No layers selected
            </p>
          ) : null}
        </div>
      </Panel>

      {/* Detail rail */}
      <div className="space-y-4">
        <Panel className="p-5">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[15px] font-medium text-ink">{selected.name}</h2>
                <ProvenanceTag value={selected.provenance} size="xs" />
              </div>
              <p className="mt-1 text-[12px] text-ink-faint">{selected.region}</p>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
                {selected.detail}
              </p>
              {selected.value > 0 ? (
                <p className="tabular mt-4 border-t border-line pt-3 text-lg text-accent">
                  {moneyShort(selected.value)}
                </p>
              ) : null}
            </>
          ) : (
            <div className="py-6 text-center">
              <p className="text-[13px] font-medium text-ink">Nothing selected</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
                Pick a pin to see what it pays and how confident the data is.
              </p>
            </div>
          )}
        </Panel>

        <Panel quiet className="p-5">
          <h3 className="text-[13px] font-semibold text-ink">
            Showing {visible.length} of {pins.length}
          </h3>
          <ul className="mt-3 space-y-1.5">
            {visible
              .slice()
              .sort((a, b) => b.value - a.value)
              .slice(0, 6)
              .map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(p)}
                    className="flex w-full items-baseline justify-between gap-3 text-left text-[12px] hover:text-ink"
                  >
                    <span className="truncate text-ink-muted">{p.name}</span>
                    <span className="tabular shrink-0 text-ink-faint">
                      {p.value > 0 ? moneyShort(p.value) : "n/a"}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
