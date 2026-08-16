import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained server output for lean Docker images and portable installs.
  output: "standalone",
  // Pin the trace root explicitly — engine/ and resolver/ each carry their
  // own package.json, and without this Next's monorepo-root auto-detection
  // can pick an ambiguous root when computing what to sweep into standalone.
  outputFileTracingRoot: __dirname,
  // Any `fs.readdirSync`/`fs.readFile` call whose path isn't a static string
  // (e.g. CONFIG_DIR-based reads all over src/lib) makes Next's file tracer
  // fall back to including the ENTIRE containing directory as a dependency —
  // and on a dev machine, CONFIG_DIR defaults to ./.movviz-data, which holds
  // the actual Plex library and torrent files. Confirmed live: a build here
  // produced a 446 GB, then a still-broken 199 GB, `.next/standalone` before
  // this covered the real path Next was resolving. None of these are ever
  // needed in the Next.js server bundle — the engine is a separate process
  // (src/instrumentation.ts spawns it) and library data is read at runtime,
  // never imported/bundled.
  outputFileTracingExcludes: {
    "*": [
      "data/**",
      "dta/**",
      ".movviz-data/**",
      "**/.movviz-data/**",
      "engine/**",
      "**/engine/**",
      "resolver/**",
      "**/resolver/**",
    ],
  },
  images: {
    // TMDB artwork + generic fallbacks. Extend as real providers are wired in.
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  // Proxy TMDb images through our domain so the browser never sees a
  // cross-origin request — kills the "No Access-Control-Allow-Origin"
  // console noise entirely, server-side, at zero cost.
  async rewrites() {
    return [
      {
        source: "/tmdb/:size/:path*",
        destination: "https://image.tmdb.org/t/p/:size/:path*",
      },
    ];
  },
};

export default nextConfig;
