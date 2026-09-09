import { NextResponse, type NextRequest } from "next/server";

/**
 * Route gate.
 *
 * Middleware runs on the edge and cannot reach the session store, so all it
 * does is check that a session cookie is present and bounce anonymous traffic
 * to sign-in. That is a cheap filter, not an authorisation check: the token is
 * still validated against the store in requireSession(), and every protected
 * page and route calls it. A forged cookie gets past this and fails there.
 */
const SESSION_COOKIE = "gml_session";

export function middleware(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  // Bring them back where they were headed once they are signed in.
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
