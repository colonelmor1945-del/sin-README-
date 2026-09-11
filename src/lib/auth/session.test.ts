import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Session resolution and the authorisation guards.
 *
 * The claim this module makes is specific: nothing about the user, their tier
 * or their role travels in the cookie, so a tampered cookie can only ever be
 * an invalid session and never a privileged one. That is a strong claim and it
 * is exactly the sort that quietly stops being true when someone adds a field
 * to the cookie to save a database round trip.
 *
 * The other claim is that the database stores only a SHA-256 of the token, so
 * a leaked dump cannot be replayed. Both are tested here against the real
 * store rather than a mock of it, because a mock would answer whatever the
 * test asked it to.
 */

const cookieJar = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: async () => cookieJar,
  headers: async () => ({ get: () => null }),
}));

class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirect:${to}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
}));

/** Presents a cookie value to the module under test. */
function signedInWith(token: string | undefined) {
  cookieJar.get.mockReturnValue(token ? { value: token } : undefined);
}

/** Runs a guard and reports where it sent the caller, if anywhere. */
async function guard<T>(fn: () => Promise<T>): Promise<{ to?: string; value?: T }> {
  try {
    return { value: await fn() };
  } catch (error) {
    if (error instanceof Redirected) return { to: error.to };
    throw error;
  }
}

describe("sessions", () => {
  let session: typeof import("@/lib/auth/session");
  let password: typeof import("@/lib/auth/password");
  let store: typeof import("@/lib/db/store");

  beforeEach(async () => {
    vi.clearAllMocks();
    session = await import("@/lib/auth/session");
    password = await import("@/lib/auth/password");
    store = await import("@/lib/db/store");
  });

  /** Creates an account and a live session, returning the raw cookie token. */
  async function makeSession(role: "member" | "admin" = "member") {
    const s = store.getStore();
    const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;

    const account = await s.createUser({
      email: `sess${stamp}@example.com`,
      username: `sess${stamp}`.slice(0, 30),
      passwordHash: await password.hashPassword("a-long-enough-password"),
    });

    if (account.role !== role) {
      await s.upsertAccount({ ...account, role });
    }

    const { token, hash } = password.newSessionToken();
    await s.createSession(hash, account.id, session.SESSION_TTL_MS);
    return { token, account };
  }

  describe("getSession", () => {
    it("returns null with no cookie", async () => {
      signedInWith(undefined);
      expect(await session.getSession()).toBeNull();
    });

    it("returns null for a token that was never issued", async () => {
      signedInWith("not-a-real-token");
      expect(await session.getSession()).toBeNull();
    });

    it("resolves a real token to its account", async () => {
      const { token, account } = await makeSession();
      signedInWith(token);

      const result = await session.getSession();
      expect(result?.account.id).toBe(account.id);
    });

    it("stores the hash of the token, not the token", async () => {
      // The point of the design: a database dump is not a set of live
      // sessions. Presenting the stored value as a cookie must not work.
      const { token } = await makeSession();
      const stored = password.hashToken(token);

      expect(stored).not.toBe(token);

      signedInWith(stored);
      expect(await session.getSession()).toBeNull();
    });
  });

  describe("requireSession", () => {
    it("sends a signed-out caller to sign in", async () => {
      signedInWith(undefined);
      expect((await guard(() => session.requireSession())).to).toBe("/login");
    });

    it("lets a signed-in caller through", async () => {
      const { token, account } = await makeSession();
      signedInWith(token);

      const result = await guard(() => session.requireSession());
      expect(result.to).toBeUndefined();
      expect(result.value?.account.id).toBe(account.id);
    });
  });

  describe("requireAdmin", () => {
    it("turns away a signed-in member", async () => {
      // Not to /login: they are signed in, they are simply not allowed here.
      const { token } = await makeSession("member");
      signedInWith(token);

      expect((await guard(() => session.requireAdmin())).to).toBe("/dashboard");
    });

    it("turns away a signed-out caller", async () => {
      signedInWith(undefined);
      expect((await guard(() => session.requireAdmin())).to).toBe("/login");
    });

    it("lets an admin through", async () => {
      const { token } = await makeSession("admin");
      signedInWith(token);

      const result = await guard(() => session.requireAdmin());
      expect(result.to).toBeUndefined();
      expect(result.value?.account.role).toBe("admin");
    });

    it("reads the role from the database, not from anything the caller sent", async () => {
      // The claim in the module's own comment. A cookie carrying a role would
      // make this trivially forgeable, so the role must come from the row.
      const { token, account } = await makeSession("member");

      // A cookie that says "admin" as loudly as a cookie can.
      signedInWith(`${token}.role=admin`);
      expect((await guard(() => session.requireAdmin())).to).toBe("/login");

      // The same person, promoted in the database, with the same cookie.
      signedInWith(token);
      await store.getStore().upsertAccount({ ...account, role: "admin" });

      const result = await guard(() => session.requireAdmin());
      expect(result.to).toBeUndefined();
    });
  });

  describe("the session cookie", () => {
    it("is not readable by scripts", async () => {
      // Session theft through an XSS hole starts with document.cookie.
      expect(session.sessionCookieOptions.httpOnly).toBe(true);
    });

    it("is not sent on cross-site requests that could act on the user", async () => {
      // lax still sends it on a top-level navigation, which is what keeps
      // following a link into the app from signing you out.
      expect(session.sessionCookieOptions.sameSite).toBe("lax");
    });

    it("is scoped to the whole site and expires", async () => {
      expect(session.sessionCookieOptions.path).toBe("/");
      expect(session.sessionCookieOptions.maxAge).toBeGreaterThan(0);
    });
  });
});
