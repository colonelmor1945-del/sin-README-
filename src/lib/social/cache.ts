import "server-only";

/**
 * A tiny in-process cache for third-party reads.
 *
 * WHY NOT `next: { revalidate }` ALONE
 * That is the right tool and the social modules use it, but it is backed by
 * Next's data cache, which on Cloudflare Workers only exists if an incremental
 * cache is configured — and `open-next.config.ts` says plainly that none is.
 * Without one, every request is a fresh isolate with no shared cache, so a
 * revalidate window is a no-op between requests and each page view becomes an
 * upstream call. This layer holds the line on its own, wherever it runs.
 *
 * WHY NOT A TABLE
 * Because then it would not be a cache. The moment somebody else's words live
 * in our database we stop holding a disposable copy and start holding a
 * record, which we would owe them the ability to delete. This map can be
 * thrown away whole at any moment and nothing is lost, which is exactly the
 * property that keeps it a cache.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

interface Store {
  entries: Map<string, Entry<unknown>>;
  inFlight: Map<string, Promise<unknown>>;
}

// Module scope is per isolate, which is the point: it survives between
// requests served by the same instance and dies with it.
const g = globalThis as { __socialCache?: Store };

function store(): Store {
  g.__socialCache ??= { entries: new Map(), inFlight: new Map() };
  return g.__socialCache;
}

/**
 * Run `load` at most once per key per TTL, and at most once concurrently.
 *
 * The second guarantee is the one that matters under load. A popular thread
 * expiring while fifty people have it open produces fifty identical calls
 * without it, which is how an integration hits a rate limit and takes every
 * other caller of the same token down with it.
 *
 * A failed load is not cached. Rate limits and outages clear on their own, and
 * remembering the failure would outlast the problem.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const { entries, inFlight } = store();

  const hit = entries.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = load()
    .then((value) => {
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

/**
 * Drop a key, or everything.
 *
 * Nothing in the app calls this on a schedule. It exists so a test can start
 * clean, and so there is an obvious answer if a thread ever needs pulling
 * before its TTL is up.
 */
export function forget(key?: string): void {
  const { entries, inFlight } = store();
  if (key === undefined) {
    entries.clear();
    inFlight.clear();
    return;
  }
  entries.delete(key);
  inFlight.delete(key);
}
