import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained server output for lean Docker images and portable installs.
  output: "standalone",
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
