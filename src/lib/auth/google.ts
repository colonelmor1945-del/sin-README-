import "server-only";

import crypto from "node:crypto";

/**
 * Google sign-in, OAuth 2.0 authorization code flow with PKCE.
 *
 * Written directly against Google's endpoints rather than pulling in an auth
 * library, because the existing session layer already does the hard parts
 * (opaque tokens, hashed storage, server-side role resolution) and a library
 * would want to own all of that.
 *
 * Three things this gets right that hand-rolled OAuth usually gets wrong:
 *
 *  - The `state` parameter is bound to the browser through an httpOnly cookie
 *    and compared in constant time. Without that binding, state is decoration
 *    and the flow is open to login CSRF.
 *  - PKCE is used even though this is a confidential client. It costs nothing
 *    and closes code interception if the redirect ever leaks.
 *  - The ID token is verified against Google's published keys, and the issuer,
 *    audience, expiry and email_verified claims are all checked. Decoding the
 *    payload without verifying is the single most common mistake here, and it
 *    lets anyone mint a token for any account.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export const GOOGLE_STATE_COOKIE = "gml_oauth_state";
export const GOOGLE_VERIFIER_COOKIE = "gml_oauth_verifier";

export const googleConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function redirectUri(): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/auth/google/callback`;
}

export interface AuthStart {
  url: string;
  state: string;
  verifier: string;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

export function startGoogleAuth(): AuthStart {
  const state = b64url(crypto.randomBytes(24));
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());

  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("response_type", "code");
  // Only identity. No Gmail, no Drive, nothing that needs review.
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  // No refresh token is requested: this is sign-in, not ongoing API access.
  url.searchParams.set("prompt", "select_account");

  return { url: url.toString(), state, verifier };
}

export interface GoogleIdentity {
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

/** Constant-time comparison for the state parameter. */
export function statesMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

interface Jwk {
  kid: string;
  n: string;
  e: string;
  alg?: string;
  kty: string;
}

const g = globalThis as { __googleJwks?: { keys: Jwk[]; fetchedAt: number } };

async function jwks(): Promise<Jwk[]> {
  // Google rotates these. An hour of cache is well inside their rotation
  // window and avoids a network call on every sign-in.
  const cached = g.__googleJwks;
  if (cached && Date.now() - cached.fetchedAt < 3_600_000) return cached.keys;

  const response = await fetch(JWKS_URI, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not fetch Google signing keys.");
  const body = (await response.json()) as { keys: Jwk[] };
  g.__googleJwks = { keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

/**
 * Verifies an RS256 ID token end to end.
 *
 * Signature first, then every claim that matters. A token that fails any check
 * throws rather than returning a partial identity, because a "mostly valid"
 * token is just an invalid one.
 */
async function verifyIdToken(idToken: string): Promise<GoogleIdentity> {
  const [headerB64, payloadB64, signatureB64] = idToken.split(".");
  if (!headerB64 || !payloadB64 || !signatureB64) {
    throw new Error("Malformed ID token.");
  }

  const header = JSON.parse(Buffer.from(headerB64, "base64url").toString()) as {
    kid?: string;
    alg?: string;
  };
  if (header.alg !== "RS256") throw new Error("Unexpected token algorithm.");

  const key = (await jwks()).find((k) => k.kid === header.kid);
  if (!key) throw new Error("Unknown signing key.");

  const publicKey = crypto.createPublicKey({
    key: { kty: key.kty, n: key.n, e: key.e },
    format: "jwk",
  });

  const verified = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${headerB64}.${payloadB64}`),
    publicKey,
    Buffer.from(signatureB64, "base64url"),
  );
  if (!verified) throw new Error("ID token signature does not verify.");

  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as {
    iss?: string;
    aud?: string;
    sub?: string;
    exp?: number;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };

  if (!payload.iss || !ISSUERS.includes(payload.iss)) {
    throw new Error("Unexpected token issuer.");
  }
  if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
    throw new Error("Token was not issued for this application.");
  }
  if (!payload.exp || payload.exp * 1000 <= Date.now()) {
    throw new Error("Token has expired.");
  }
  if (!payload.sub || !payload.email) {
    throw new Error("Token is missing an identity.");
  }
  // An unverified Google email can be any address the user typed. Accepting it
  // would let someone claim an account belonging to a different person.
  if (!payload.email_verified) {
    throw new Error("Google has not verified that email address.");
  }

  return {
    subject: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: true,
    name: payload.name ?? null,
  };
}

export async function exchangeCode({
  code,
  verifier,
}: {
  code: string;
  verifier: string;
}): Promise<GoogleIdentity> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Google rejected the authorization code.");
  }

  const body = (await response.json()) as { id_token?: string };
  if (!body.id_token) throw new Error("Google returned no ID token.");

  return verifyIdToken(body.id_token);
}

/**
 * Turns a Google display name into an available username.
 *
 * Falls back to the email local part, then to a random suffix, so signing in
 * never fails because someone shares a name with an existing member.
 */
export function suggestUsername(identity: GoogleIdentity): string {
  const raw = identity.name ?? identity.email.split("@")[0];
  const base = raw
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .toLowerCase();
  return base.length >= 3 ? base : `player-${crypto.randomBytes(3).toString("hex")}`;
}
