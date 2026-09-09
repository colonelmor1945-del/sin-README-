import { NextResponse } from "next/server";

import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  googleConfigured,
  startGoogleAuth,
} from "@/lib/auth/google";

export const runtime = "nodejs";

/**
 * Starts the Google sign-in flow.
 *
 * The state and PKCE verifier are stored in short-lived httpOnly cookies, which
 * is what binds the callback to this browser. Ten minutes is generous for a
 * consent screen and short enough that a leaked value is worthless.
 */
export async function GET() {
  if (!googleConfigured()) {
    return NextResponse.redirect(
      new URL("/login?error=google-unconfigured", process.env.APP_URL ?? "http://localhost:3000"),
    );
  }

  const { url, state, verifier } = startGoogleAuth();
  const response = NextResponse.redirect(url);

  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  };
  response.cookies.set(GOOGLE_STATE_COOKIE, state, options);
  response.cookies.set(GOOGLE_VERIFIER_COOKIE, verifier, options);

  return response;
}
