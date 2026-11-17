import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Durchgehend dynamisch (Live-Daten, Rollen) → kein Cache Components / PPR
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
