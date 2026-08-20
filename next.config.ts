import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // The Prisma client is a native-ish dependency; keep it out of the bundle.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],

  experimental: {
    // Server Actions cap request bodies at 1 MB by default, and every upload in
    // this product promises 20 MB — the profile documents, the donor guidelines
    // and a call received by email. A 1.9 MB donor PDF, an entirely ordinary
    // size, failed with an opaque 500 before reaching the validator that would
    // have accepted it, so the interface was telling people a limit the runtime
    // did not honour.
    //
    // 24 MB rather than 20: multipart framing and the file name ride along with
    // the bytes, and a file exactly at the limit should be refused by the check
    // that can explain why, not by the transport.
    serverActions: { bodySizeLimit: "24mb" },
  },
};

export default config;
