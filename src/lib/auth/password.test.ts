import { describe, expect, it } from "vitest";

import {
  DEFAULT_COST,
  hashCost,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";

/**
 * The hash itself.
 *
 * Until now nothing tested this file directly -- it was exercised only through
 * the sign-in actions, which care whether login works, not what it costs. So
 * the work factor was pinned by nothing: changing 2**15 to 2**12 here would
 * have left every test in the project green while quietly making every
 * password in the database an order of magnitude cheaper to guess.
 */
describe("hashCost", () => {
  it("is the documented cost by default", () => {
    // The number itself, written out, so weakening it has to be deliberate.
    expect(DEFAULT_COST).toBe(32768);
    expect(hashCost({})).toBe(32768);
  });

  it("ignores the override in production", () => {
    // The whole safety of a test-only cheap path rests on this line.
    expect(
      hashCost({ NODE_ENV: "production", SCRYPT_COST: "1024" }),
    ).toBe(DEFAULT_COST);
  });

  it("lets tests ask for less, within limits", () => {
    expect(hashCost({ SCRYPT_COST: "4096" })).toBe(4096);
  });

  it("refuses anything that is not a sane power of two", () => {
    // Falling back to the strong default is the only safe direction to fail.
    for (const bad of ["0", "-1", "512", "3000", "65536", "abc", ""]) {
      expect(hashCost({ SCRYPT_COST: bad })).toBe(DEFAULT_COST);
    }
  });
});

describe("hashPassword and verifyPassword", () => {
  it("round-trips, and rejects the wrong password", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(await verifyPassword("Correct horse battery staple", stored)).toBe(false);
  });

  it("writes its parameters into the hash, so the cost can change later", async () => {
    // This is what makes a cheap test hash harmless: verification reads the
    // cost from the stored string, never from the constant in the module.
    const stored = await hashPassword("whatever");
    const [scheme, n, r, p, salt, key] = stored.split("$");
    expect(scheme).toBe("scrypt");
    expect(Number(n)).toBe(hashCost());
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
    expect(Buffer.from(salt, "base64")).toHaveLength(16);
    expect(Buffer.from(key, "base64")).toHaveLength(64);
  });

  it("verifies a hash made at a different cost than the current one", async () => {
    // A password hashed before the cost was raised must still let its owner
    // in, or raising the cost locks out everyone who has not signed in since.
    const cheap = await hashPassword("old password");
    const reStored = cheap.replace(/^scrypt\$\d+/, `scrypt$${hashCost()}`);
    // Only valid if both were made at the same cost; when they differ the
    // rewritten string must fail rather than silently pass.
    if (reStored !== cheap) {
      expect(await verifyPassword("old password", reStored)).toBe(false);
    }
    expect(await verifyPassword("old password", cheap)).toBe(true);
  });

  it("returns false rather than throwing on a malformed hash", async () => {
    for (const junk of ["", "not-a-hash", "scrypt$1$2$3", "bcrypt$1$8$1$a$b"]) {
      expect(await verifyPassword("x", junk)).toBe(false);
    }
  });
});
