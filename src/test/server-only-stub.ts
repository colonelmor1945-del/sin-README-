/**
 * Stub for the `server-only` package under test.
 *
 * The real package throws at build time if a server module reaches a client
 * bundle. Vitest builds no client bundle, so importing the real one is a
 * pointless failure. `next build` still enforces the boundary.
 */
export {};
