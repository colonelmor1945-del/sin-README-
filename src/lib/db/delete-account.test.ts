import { beforeEach, describe, expect, it } from "vitest";

import { memoryStore } from "./store";

/**
 * Erasure against the in-memory adapter.
 *
 * The Postgres adapter leans on the schema's cascades, which are covered by
 * schema.test.ts against a real database. These cover the part that is hand
 * written, where a forgotten index is how a deleted account stays signed in
 * or keeps its address reserved forever.
 */
async function makeUser(suffix: string) {
  return memoryStore.createUser({
    email: `gone-${suffix}@example.com`,
    username: `gone${suffix}`,
    passwordHash: "scrypt$fake",
  });
}

describe("deleteAccount", () => {
  let id: string;

  beforeEach(async () => {
    const account = await makeUser(String(Date.now()) + Math.random());
    id = account.id;
  });

  it("removes the account", async () => {
    await memoryStore.deleteAccount(id);
    expect(await memoryStore.getAccount(id)).toBeNull();
  });

  it("frees the address so the same person can come back", async () => {
    const account = await memoryStore.getAccount(id);
    const email = account!.email;

    expect(await memoryStore.emailTaken(email)).toBe(true);
    await memoryStore.deleteAccount(id);
    expect(await memoryStore.emailTaken(email)).toBe(false);
  });

  it("frees the username too", async () => {
    const account = await memoryStore.getAccount(id);
    await memoryStore.deleteAccount(id);
    expect(await memoryStore.usernameTaken(account!.username)).toBe(false);
  });

  it("kills every session, not just the one that asked", async () => {
    // The obvious bug: sessions are keyed by token hash, so deleting the user
    // row leaves other devices holding live tokens for an account that is gone.
    await memoryStore.createSession("hash-a", id, 60_000);
    await memoryStore.createSession("hash-b", id, 60_000);

    await memoryStore.deleteAccount(id);

    expect(await memoryStore.resolveSession("hash-a")).toBeNull();
    expect(await memoryStore.resolveSession("hash-b")).toBeNull();
  });

  it("leaves other people alone", async () => {
    const other = await makeUser("bystander" + Math.random());
    await memoryStore.createSession("hash-other", other.id, 60_000);

    await memoryStore.deleteAccount(id);

    expect(await memoryStore.getAccount(other.id)).not.toBeNull();
    expect(await memoryStore.resolveSession("hash-other")).not.toBeNull();
  });

  it("is safe to call twice", async () => {
    await memoryStore.deleteAccount(id);
    await expect(memoryStore.deleteAccount(id)).resolves.toBeUndefined();
  });

  it("does nothing for an id that never existed", async () => {
    await expect(
      memoryStore.deleteAccount("00000000-0000-0000-0000-000000000000"),
    ).resolves.toBeUndefined();
  });
});
