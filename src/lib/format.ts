/** Display helpers. Pure, no React, safe to use on the server and the client. */

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

/** In-game dollars. Always whole units. */
export const money = (n: number) => usd.format(Math.round(n));

/** Real money, for the pricing and support pages. */
export const price = (n: number) => eur.format(n);

/** Compact in-game money for tight cells: 4_752_000 becomes "$4.75M". */
export function moneyShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

/** 512 becomes "8h 32m". Input is minutes. */
export function duration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;

/** Clamp helper used by progress rings and bars. */
export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
