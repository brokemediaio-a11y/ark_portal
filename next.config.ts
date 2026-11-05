import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Native module: must be loaded by Node at runtime, not bundled.
  serverExternalPackages: ["@napi-rs/canvas"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
