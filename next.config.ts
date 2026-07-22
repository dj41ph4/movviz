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
};

export default nextConfig;
