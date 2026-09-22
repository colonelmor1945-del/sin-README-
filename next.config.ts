import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Where the build writes.
   *
   * A production build and the dev server share .next by default, and the
   * build overwrites the dev server assets while it is running. The symptom is
   * brutal to diagnose: the dev server keeps serving 200s and compiling fine,
   * but its stylesheet starts 404ing, so every Tailwind utility silently stops
   * applying and the page renders unstyled with no error anywhere. It cost an
   * hour once. Setting NEXT_DIST_DIR sends a verification build somewhere else.
   */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",

  /*
   * Packages the server must load itself rather than have bundled.
   *
   * PGlite ships PostgreSQL as WebAssembly and locates the .wasm next to its
   * own module with `new URL(..., import.meta.url)`, then hands that URL to
   * node:fs. Bundled, it gets the bundler's URL rather than the runtime's, and
   * fs rejects it with a message that reads like a contradiction: "must be of
   * type string or an instance of URL. Received an instance of URL." Two
   * classes with the same name from different realms.
   *
   * Left external, it is loaded by Node and the URL is the one fs expects.
   * It is a devDependency and only `npm run dev:db` ever reaches it, so
   * nothing here follows it into a production bundle.
   */
  serverExternalPackages: ["@electric-sql/pglite"],

  /*
   * Remote image hosts.
   *
   * next/image THROWS on an unlisted hostname rather than falling back, so a
   * host we forgot takes down the whole page that renders it. /dashboard/feed
   * was a 500 for exactly this reason: only `i.ytimg.com` was listed, but the
   * YouTube Data API hands back thumbnails on the numbered shards
   * (i1-i4.ytimg.com) depending on which one it picks for a video.
   *
   * So list the shards by wildcard, and list Reddit's hosts too — the feed
   * renders those through the same component, and they would have been the
   * next 500 the moment a Reddit post came back with a preview image.
   */
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      // YouTube: i.ytimg.com plus the i1-i4 shards, and the legacy img host.
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "*.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      // Reddit: previews, direct uploads, and the thumbnail CDN.
      { protocol: "https", hostname: "preview.redd.it" },
      { protocol: "https", hostname: "external-preview.redd.it" },
      { protocol: "https", hostname: "i.redd.it" },
      { protocol: "https", hostname: "*.thumbs.redditmedia.com" },
    ],
  },
};

export default nextConfig;
