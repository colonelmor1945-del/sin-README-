import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { hashToken } from "@/lib/auth/password";
import { getStore, type Account } from "@/lib/db/store";

/**
 * Session resolution.
 *
 * The cookie holds an opaque random token. The database stores only its
 * SHA-256, so a leaked dump cannot be replayed as a live session. Nothing
 * about the user, their tier or their role travels in the cookie, which means
 * a tampered cookie can only ever be an invalid session, never a privileged
 * one.
 */

export const SESSION_COOKIE = "gml_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export interface Session {
  userId: string;
  account: Account;
}

/** Returns null when signed out. Use this on surfaces that allow both. */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const account = await getStore().resolveSession(hashToken(token));
  return account ? { userId: account.id, account } : null;
}

/** Redirects to sign-in when there is no session. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Route guard for admin surfaces. Authorisation is always server-side. */
export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.account.role !== "admin") redirect("/dashboard");
  return session;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
};
