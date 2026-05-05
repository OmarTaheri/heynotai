import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emit a self-contained runtime bundle at .next/standalone so the
  // production Docker image (frontend/Dockerfile) doesn't need the
  // full pnpm node_modules tree.
  output: "standalone",
};

export default nextConfig;
