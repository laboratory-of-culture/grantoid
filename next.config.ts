import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // The Prisma client is a native-ish dependency; keep it out of the bundle.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default config;
