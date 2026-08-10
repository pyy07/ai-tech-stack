import type { NextConfig } from "next";

/**
 * Dual deploy:
 * - Vercel / local: leave BASE_PATH empty → site at /
 * - GitHub Pages project site: BASE_PATH=/ai-tech-stack
 */
const rawBase = (process.env.BASE_PATH || "").trim().replace(/\/$/, "");
const basePath = rawBase
  ? rawBase.startsWith("/")
    ? rawBase
    : `/${rawBase}`
  : "";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  ...(basePath
    ? {
        basePath,
        assetPrefix: basePath,
      }
    : {}),
};

export default nextConfig;
