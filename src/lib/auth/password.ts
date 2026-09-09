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

const N = 2 ** 15; // CPU and memory cost. About 32 MB per hash at r=8.
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

// The default maxmem is too low for N=2^15 and throws. 128 * N * r, doubled.
const MAX_MEM = 256 * N * R;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LEN);
  const key = await scrypt(password.normalize("NFKC"), salt, KEY_LEN, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEM,
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
  await scrypt("decoy", crypto.randomBytes(SALT_LEN), KEY_LEN, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEM,
  });
}
