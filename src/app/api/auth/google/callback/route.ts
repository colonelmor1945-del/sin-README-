import { NextResponse } from "next/server";

import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  exchangeCode,
  googleConfigured,
  statesMatch,
  suggestUsername,
} from "@/lib/auth/google";
import { hashPassword, newSessionToken } from "@/lib/auth/password";
import { SESSION_COOKIE, SESSION_TTL_MS, sessionCookieOptions } from "@/lib/auth/session";
import { getStore } from "@/lib/db/store";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
const fail = (reason: string) =>
  NextResponse.redirect(new URL(`/login?error=${reason}`, appUrl()));

/**
 * Google sign-in callback.
 *
 * Order matters. State is checked before the code is spent, so a forged
 * callback never reaches Google's token endpoint. The state and verifier
 * cookies are cleared on every path, success or failure, so a replay finds
 * nothing to work with.
 */
export async function GET(request: Request) {
  if (!googleConfigured()) return fail("google-unconfigured");

  const limit = rateLimit("google-callback", { limit: 30, windowMs: 60_000 });
  if (!limit.ok) return fail("rate-limited");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // The user pressed cancel on the consent screen. Not an error worth shouting about.
  if (url.searchParams.get("error")) return fail("cancelled");
  if (!code || !state) return fail("bad-callback");

  const cookieHeader = request.headers.get("cookie") ?? "";
  const read = (name: string) =>
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1);

  const expectedState = read(GOOGLE_STATE_COOKIE);
  const verifier = read(GOOGLE_VERIFIER_COOKIE);

  // Without this comparison the state parameter is decoration and the flow is
  // open to login CSRF.
  if (!expectedState || !verifier || !statesMatch(state, expectedState)) {
    return fail("state-mismatch");
  }

  let response: NextResponse;

  try {
    const identity = await exchangeCode({ code, verifier });
    const store = getStore();

    let account = await store.findByEmail(identity.email);

    if (!account) {
      // First sign-in. A random password hash is stored so the row has the
      // same shape as a password account; it is unusable and unguessable, and
      // the user signs in with Google from here on.
      let username = suggestUsername(identity);
      if (await store.usernameTaken(username)) {
        username = `${username.slice(0, 26)}-${Math.random().toString(36).slice(2, 6)}`;
      }
      const created = await store.createUser({
        email: identity.email,
        username,
        passwordHash: await hashPassword(crypto.randomUUID() + crypto.randomUUID()),
      });
      account = { ...created, passwordHash: "" };
    }

    const { token, hash } = newSessionToken();
    await store.createSession(hash, account.id, SESSION_TTL_MS);

    response = NextResponse.redirect(new URL("/dashboard", appUrl()));
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  } catch (error) {
    console.warn("[google] callback failed", error);
    response = fail("google-failed");
  }

  // Cleared on every path, so nothing is left behind to replay.
  response.cookies.delete(GOOGLE_STATE_COOKIE);
  response.cookies.delete(GOOGLE_VERIFIER_COOKIE);
  return response;
}
