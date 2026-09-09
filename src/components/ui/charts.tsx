import { clamp01 } from "@/lib/format";

/**
 * Chart primitives, drawn as inline SVG.
 *
 * No chart library. These are two shapes, and a dependency would cost more
 * bundle than it saves. Both are server components.
 */

export function Sparkline({
  values,
  tone = "flat",
  width = 96,
  height = 26,
  label,
}: {
  values: number[];
  tone?: "up" | "down" | "flat";
  width?: number;
  height?: number;
  label: string;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);

  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - 2 - ((v - min) / span) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const stroke = {
    up: "var(--color-up)",
    down: "var(--color-down)",
    flat: "var(--color-flat)",
  }[tone];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className="overflow-visible"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={points[points.length - 1].split(",")[0]}
        cy={points[points.length - 1].split(",")[1]}
        r={2}
        fill={stroke}
      />
    </svg>
  );
}

export function ProgressRing({
  value,
  size = 108,
  stroke = 8,
  caption,
}: {
  /** 0 to 1. */
  value: number;
  size?: number;
  stroke?: number;
  caption?: string;
}) {
  const v = clamp01(value);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = circumference * v;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${Math.round(v * 100)} percent complete`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="tabular text-xl text-ink">{Math.round(v * 100)}%</span>
        {caption ? (
          <span className="text-[10px] text-ink-faint">{caption}</span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Inline comparison bar without a filled background track. A full track reads
 * as dashboard clutter and adds no information the number does not carry.
 */
export function Meter({ value, tone = "accent" }: { value: number; tone?: "accent" | "up" }) {
  const color = tone === "up" ? "var(--color-up)" : "var(--color-accent)";
  return (
    <span
      className="inline-block h-[3px] w-full max-w-[120px] rounded-full"
      style={{
        background: `linear-gradient(to right, ${color} ${clamp01(value) * 100}%, var(--color-line) ${clamp01(value) * 100}%)`,
      }}
      aria-hidden
    />
  );
}
