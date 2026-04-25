import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.amazon.com" },
      { protocol: "https", hostname: "**.amazon.in" },
      { protocol: "https", hostname: "m.media-amazon.com" },
    ],
  },
  // Puppeteer uses Node APIs not available in Edge runtime
  serverExternalPackages: ["puppeteer-core"],
};

export default nextConfig;
