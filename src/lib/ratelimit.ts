import "server-only";

/**
 * Fixed-window rate limiter.
 *
 * In-process, which is correct for a single node and wrong for a fleet.
 * Swap the Bucket map for Redis (or Upstash) before running more than one
 * instance. The call signature does not change.
 *
 * This sits in front of every AI route. It is abuse protection, separate from
 * the per-tier quota in entitlements.ts, which is a product limit.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets: Map<string, Bucket> =
  (globalThis as { __labBuckets?: Map<string, Bucket> }).__labBuckets ??
  ((globalThis as { __labBuckets?: Map<string, Bucket> }).__labBuckets = new Map());

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowMs };
    buckets.set(key, fresh);
    return { ok: true, remaining: limit - 1, resetAt: fresh.resetAt };
  }

  bucket.count += 1;
  return {
    ok: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

/** Standard budgets. AI calls cost money, so they are the tightest. */
export const BUDGETS = {
  aiChat: { limit: 20, windowMs: 60_000 },
  aiPlan: { limit: 6, windowMs: 60_000 },
  aiCreator: { limit: 10, windowMs: 60_000 },
  read: { limit: 120, windowMs: 60_000 },
} as const;

/** Opportunistic sweep so the map does not grow without bound. */
export function sweep(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
