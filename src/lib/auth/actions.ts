"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  fakeVerify,
  hashPassword,
  hashToken,
  newSessionToken,
  verifyPassword,
} from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { getStore } from "@/lib/db/store";
import { rateLimit } from "@/lib/ratelimit";

/**
 * Authentication server actions.
 *
 * Rules applied throughout:
 *  - Sign-in never says whether the email exists. Wrong email and wrong
 *    password return the same message, and the no-such-user path burns the
 *    same time as a real hash so the difference is not observable by timing.
 *  - Rate limits are keyed on the client IP, because the attacker controls the
 *    email field and would otherwise get a fresh bucket per guess.
 *  - The session cookie is set only after the credential check passes.
 */

export interface AuthState {
  error?: string;
  field?: "email" | "username" | "password";
  /** Echoed back so a validation error does not wipe what was typed. Never the password. */
  values?: { email?: string; username?: string };
}

const Email = z.string().trim().toLowerCase().email("That email does not look right.");

const Password = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200, "That password is too long.");

const Username = z
  .string()
  .trim()
  .min(3, "At least 3 characters.")
  .max(32, "At most 32 characters.")
  .regex(/^[a-zA-Z0-9_-]+$/, "Letters, numbers, hyphen and underscore only.");

const RegisterInput = z.object({
  email: Email,
  username: Username,
  password: Password,
});

const LoginInput = z.object({
  email: Email,
  password: z.string().min(1, "Enter your password."),
});

async function clientKey(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown"
  );
}

async function startSession(userId: string) {
  const { token, hash } = newSessionToken();
  await getStore().createSession(hash, userId, SESSION_TTL_MS);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
}

export async function register(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const typed = {
    email: String(formData.get("email") ?? ""),
    username: String(formData.get("username") ?? ""),
  };
  const limit = rateLimit(`register:${await clientKey()}`, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.ok) {
    return { error: "Too many accounts created from here. Try again later.", values: typed };
  }

  const parsed = RegisterInput.safeParse({
    email: formData.get("email"),
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: issue.message,
      field: issue.path[0] as AuthState["field"],
      values: typed,
    };
  }

  const { email, username, password } = parsed.data;
  const store = getStore();

  if (await store.emailTaken(email)) {
    return { error: "That email is already registered.", field: "email", values: typed };
  }
  if (await store.usernameTaken(username)) {
    return { error: "That username is taken.", field: "username", values: typed };
  }

  const account = await store.createUser({
    email,
    username,
    passwordHash: await hashPassword(password),
  });

  await startSession(account.id);
  redirect("/dashboard");
}

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const typed = { email: String(formData.get("email") ?? "") };
  const limit = rateLimit(`login:${await clientKey()}`, {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.ok) {
    return { error: "Too many sign-in attempts. Wait a few minutes.", values: typed };
  }

  const parsed = LoginInput.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter your email and password.", values: typed };
  }

  const record = await getStore().findByEmail(parsed.data.email);

  // Same message and comparable cost on both failure paths, so neither the
  // wording nor the response time reveals whether the account exists.
  const generic = {
    error: "Email or password is incorrect.",
    field: "password" as const,
    values: typed,
  };

  if (!record) {
    await fakeVerify();
    return generic;
  }
  if (!(await verifyPassword(parsed.data.password, record.passwordHash))) {
    return generic;
  }

  await startSession(record.id);
  redirect("/dashboard");
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await getStore().deleteSession(hashToken(token));
  jar.delete(SESSION_COOKIE);
  redirect("/");
}
