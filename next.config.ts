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

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
};

export default nextConfig;
