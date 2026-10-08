import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (local demo database) ships WASM files that must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite", "node-ical"],
  devIndicators: false,
};

export default nextConfig;
