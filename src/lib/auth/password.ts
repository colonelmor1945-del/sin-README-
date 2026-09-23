import "server-only";

import crypto from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing.
 *
 * scrypt from the Node standard library. It is a memory-hard KDF, it is in
 * every Node runtime, and it needs no native module, which matters because a
 * failed native build at deploy time is a bad way to discover your auth is
 * broken. Argon2id is the stronger choice if you are willing to take the
 * dependency; the interface below is the only thing you would need to swap.
 *
 * Format stored in the database:
 *   scrypt$N$r$p$<salt base64>$<derived key base64>
 *
 * The parameters travel with the hash, so raising the cost later does not
 * invalidate existing passwords. Verification reads the parameters from the
 * stored string, not from the constants below.
 */
const scrypt = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions,
) => Promise<Buffer>;

/** CPU and memory cost. About 32 MB per hash at r=8. */
export const DEFAULT_COST = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

/**
 * The work factor to hash new passwords with.
 *
 * Always DEFAULT_COST in production. Outside it, SCRYPT_COST may lower it,
 * and only the test suite does.
 *
 * WHY THIS EXISTS
 * Every test that signs anyone in pays for a real hash -- deliberately
 * expensive, 32 MB, and the lockout tests do eleven in a row. On a loaded
 * machine that is past any timeout worth setting, so those tests failed by the
 * clock, intermittently, which teaches people to rerun rather than to look.
 * None of them are about the hash: they are about the counter that limits
 * attempts, and the cost is incidental to every assertion they make.
 *
 * WHY IT IS SAFE
 * Production ignores the variable outright rather than validating it, so a
 * stray value in a deployment environment cannot weaken anything -- and it is
 * ignored rather than rejected, because throwing on a stray env var would turn
 * a typo into an outage. The parameters travel with each hash, so a cheap
 * test hash verifies at its own cost and never teaches the verifier anything.
 * `password.test.ts` pins the production number, which nothing did before:
 * changing 2**15 to 2**12 in this file used to break no test at all.
 */
export function hashCost(env: Record<string, string | undefined> = process.env): number {
  if (env.NODE_ENV === "production") return DEFAULT_COST;

  const asked = Number(env.SCRYPT_COST);
  const usable =
    Number.isInteger(asked) && asked >= 2 ** 10 && asked <= DEFAULT_COST &&
    (asked & (asked - 1)) === 0; // scrypt requires a power of two
  return usable ? asked : DEFAULT_COST;
}

// The default maxmem is too low for N=2^15 and throws. 128 * N * r, doubled.
const maxMem = (n: number) => 256 * n * R;

export async function hashPassword(password: string): Promise<string> {
  const N = hashCost();
  const salt = crypto.randomBytes(SALT_LEN);
  const key = await scrypt(password.normalize("NFKC"), salt, KEY_LEN, {
    N,
    r: R,
    p: P,
    maxmem: maxMem(N),
  });
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltB64, keyB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");

  let actual: Buffer;
  try {
    actual = await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 256 * Number(n) * Number(r),
    });
  } catch {
    return false;
  }

  // Length check first: timingSafeEqual throws on a mismatch rather than
  // returning false, and a thrown error would leak the difference.
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

/**
 * Opaque session token. 32 random bytes, and only its SHA-256 is stored, so a
 * leaked database dump cannot be replayed as a live session.
 */
export function newSessionToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

/**
 * Burns roughly the same time as a real verification. Called when the email
 * does not exist, so signup status cannot be probed by response timing.
 */
export async function fakeVerify(): Promise<void> {
  // The same cost the real one would pay, so the decoy stays a decoy: a
  // hardcoded factor here would burn a different amount of time than a real
  // verification and hand back the timing difference it exists to hide.
  const N = hashCost();
  await scrypt("decoy", crypto.randomBytes(SALT_LEN), KEY_LEN, {
    N,
    r: R,
    p: P,
    maxmem: maxMem(N),
  });
}
