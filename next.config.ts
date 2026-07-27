import type { NextConfig } from "next";

const brainstormApiProxy =
  process.env.BRAINSTORM_API_PROXY?.replace(/\/$/, "") ?? "http://127.0.0.1:3001";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "github.com" },
      { protocol: "https", hostname: "*.cloudfront.net" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/brainstorm/:path*",
        destination: `${brainstormApiProxy}/api/v1/brainstorm/:path*`,
      },
      {
        source: "/fillers/:path*",
        destination: `${brainstormApiProxy}/fillers/:path*`,
      },
      {
        source: "/health",
        destination: `${brainstormApiProxy}/health`,
      },
    ];
  },
};

export default nextConfig;
