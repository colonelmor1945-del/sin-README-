import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sign-in and sign-up server actions.
 *
 * These are the only path a password travels down, and they were the largest
 * untested surface in the project. A server action is a public HTTP endpoint
 * with a generated name, not a private function, so everything here is reachable
 * by anyone who can find the id.
 *
 * What is worth asserting is not "does login work" — that breaks loudly. It is
 * the set of properties that can be removed without anything appearing to
 * break at all:
 *
 *   - failing the same way whether or not the account exists,
 *   - never issuing a session cookie on a failed attempt,
 *   - never echoing the password back into the form state,
 *   - rate limiting on the caller rather than on the field they control.
 *
 * Each of those is a one-line change away from being lost, and losing any of
 * them leaves every test that checks "can a user sign in" passing.
 */

/* --- The Next.js request context ---------------------------------------- */

const cookieJar = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

let requestHeaders = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => cookieJar,
  headers: async () => ({
    get: (name: string) => requestHeaders.get(name.toLowerCase()) ?? null,
  }),
}));

/**
 * Next's redirect throws a special error to unwind the request, which is how
 * an action can end by navigating. Tests treat that throw as the signal that
 * the action finished successfully.
 */
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

/**
 * Runs an action and reports whether it redirected, without the throw escaping.
 *
 * Generic over the action's own state type rather than taking unknown, so this
 * keeps type checking on the assertions. Vitest does not typecheck, so a
 * loosely typed helper here passes its tests and fails the build.
 */
async function run<S>(
  action: (prev: S, data: FormData) => Promise<S>,
  fields: Record<string, string>,
): Promise<{ redirectedTo?: string; state?: S }> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);

  try {
    // The actions ignore the previous state; an empty one stands in for the
    // first render.
    return { state: await action({} as S, form) };
  } catch (error) {
    if (error instanceof Redirected) return { redirectedTo: error.to };
    throw error;
  }
}

const from = (ip: string) => {
  requestHeaders = new Map([["x-forwarded-for", ip]]);
};

/** A fresh IP per test, so one test's rate limit bucket cannot fail another. */
let ipCounter = 0;
const freshIp = () => `10.0.0.${++ipCounter % 250}.${Date.now() % 1000}`;

describe("auth actions", () => {
  let actions: typeof import("@/lib/auth/actions");
  let store: typeof import("@/lib/db/store");

  beforeEach(async () => {
    vi.clearAllMocks();
    from(freshIp());
    actions = await import("@/lib/auth/actions");
    store = await import("@/lib/db/store");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* --- Registration ---------------------------------------------------- */

  describe("register", () => {
    it("creates an account and starts a session", async () => {
      const email = `new${Date.now()}@example.com`;
      const result = await run(actions.register, {
        email,
        username: `user${Date.now() % 100000}`,
        password: "a-long-enough-password",
      });

      expect(result.redirectedTo).toBe("/dashboard");
      expect(cookieJar.set).toHaveBeenCalledTimes(1);
    });

    it("stores a hash, never the password", async () => {
      const email = `hash${Date.now()}@example.com`;
      const password = "correct-horse-battery";

      await run(actions.register, {
        email,
        username: `hash${Date.now() % 100000}`,
        password,
      });

      const record = await store.getStore().findByEmail(email);
      expect(record).not.toBeNull();
      expect(record!.passwordHash).not.toContain(password);
      expect(record!.passwordHash).toMatch(/^scrypt\$/);
    });

    it("treats an address as the same account whatever its case or padding", async () => {
      // Two accounts for one person is a support problem and a security one:
      // a password reset would only ever fix one of them.
      const email = `Case${Date.now()}@Example.COM`;
      await run(actions.register, {
        email,
        username: `case${Date.now() % 100000}`,
        password: "a-long-enough-password",
      });

      const second = await run(actions.register, {
        email: `  ${email.toLowerCase()}  `,
        username: `other${Date.now() % 100000}`,
        password: "a-long-enough-password",
      });

      expect(second.state?.error).toMatch(/already registered/i);
    });

    it("refuses a password shorter than the stated rule", async () => {
      const result = await run(actions.register, {
        email: `short${Date.now()}@example.com`,
        username: `short${Date.now() % 100000}`,
        password: "short",
      });

      expect(result.state?.field).toBe("password");
      expect(cookieJar.set).not.toHaveBeenCalled();
    });

    it("never echoes the password back, only the harmless fields", async () => {
      // The returned state is serialised into the page. A password in it would
      // be sitting in the HTML.
      const password = "a-long-enough-password";
      const result = await run(actions.register, {
        email: "not-an-email",
        username: "someone",
        password,
      });

      const serialised = JSON.stringify(result.state);
      expect(serialised).not.toContain(password);
      expect(serialised).toContain("someone");
    });
  });

  /* --- Sign in ---------------------------------------------------------- */

  describe("login", () => {
    const password = "a-long-enough-password";
    let email: string;

    beforeEach(async () => {
      email = `login${Date.now()}${ipCounter}@example.com`;
      await run(actions.register, {
        email,
        username: `login${Date.now() % 100000}${ipCounter}`,
        password,
      });
      vi.clearAllMocks();
      from(freshIp());
    });

    it("signs in with the right password", async () => {
      const result = await run(actions.login, { email, password });

      expect(result.redirectedTo).toBe("/dashboard");
      expect(cookieJar.set).toHaveBeenCalledTimes(1);
    });

    it("fails identically for a wrong password and an unknown account", async () => {
      // The property that keeps an attacker from using the sign-in form to
      // find out which addresses have accounts.
      const wrongPassword = await run(actions.login, {
        email,
        password: "not-the-password",
      });

      from(freshIp());
      const noSuchUser = await run(actions.login, {
        email: `absent${Date.now()}@example.com`,
        password: "not-the-password",
      });

      expect(wrongPassword.state?.error).toBe(noSuchUser.state?.error);
      expect(wrongPassword.state?.field).toBe(noSuchUser.state?.field);
      expect(String(wrongPassword.state?.error)).not.toMatch(/no account|not found|unknown/i);
    });

    it("issues no cookie when the password is wrong", async () => {
      await run(actions.login, { email, password: "not-the-password" });
      expect(cookieJar.set).not.toHaveBeenCalled();
    });

    it("issues no cookie when the account does not exist", async () => {
      await run(actions.login, {
        email: `absent${Date.now()}@example.com`,
        password,
      });
      expect(cookieJar.set).not.toHaveBeenCalled();
    });

    it("locks out after repeated attempts from one caller", async () => {
      const ip = freshIp();
      from(ip);

      // The limit is ten in fifteen minutes.
      for (let i = 0; i < 10; i++) {
        await run(actions.login, { email, password: "wrong" });
      }

      const blocked = await run(actions.login, { email, password: "wrong" });
      expect(String(blocked.state?.error)).toMatch(/too many/i);
    });

    it("counts attempts against the caller, not the address they typed", async () => {
      // Keying on the email would hand an attacker a fresh allowance with
      // every guess, which is the opposite of a rate limit.
      const ip = freshIp();
      from(ip);

      for (let i = 0; i < 10; i++) {
        await run(actions.login, {
          email: `varies${i}@example.com`,
          password: "wrong",
        });
      }

      const blocked = await run(actions.login, { email, password });
      expect(String(blocked.state?.error)).toMatch(/too many/i);
      expect(cookieJar.set).not.toHaveBeenCalled();
    });

    it("still refuses the correct password once the caller is locked out", async () => {
      const ip = freshIp();
      from(ip);

      for (let i = 0; i < 11; i++) {
        await run(actions.login, { email, password: "wrong" });
      }

      const result = await run(actions.login, { email, password });
      expect(result.redirectedTo).toBeUndefined();
      expect(cookieJar.set).not.toHaveBeenCalled();
    });
  });
});
