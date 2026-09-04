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

  /**
   * Security response headers applied to every route.
   *
   * A nonce-based CSP was the first attempt and did not survive contact with
   * static rendering: Next only stamps its scripts with a middleware nonce on
   * dynamically rendered routes, and the pages here are static, so `'strict-
   * dynamic'` blocked every script and left the page inert. This is the CSP that
   * works — strict where it costs nothing, `'unsafe-inline'` only for scripts,
   * because Next emits inline RSC-streaming scripts that change every build and
   * so cannot be hashed. That relaxation is acceptable here specifically: there
   * is no `dangerouslySetInnerHTML` and no other HTML-injection sink in the app,
   * so React's escaping already denies an attacker a place to put inline script.
   * What the policy is really buying is the rest — nothing loads from off-site,
   * the page cannot be framed, and `base-uri`/`form-action` are pinned.
   *
   * HSTS is stated here as well as at the Cloudflare edge, so the guarantee does
   * not depend on an edge setting nobody can see from the repo.
   */
  async headers() {
    // Cloudflare injects its Web Analytics beacon at the edge, on our own
    // infrastructure. Left out of the policy it would be blocked while still
    // injected, which is a console error on every page load rather than a
    // defence — so it is allowed by name: the script origin, and the endpoint
    // the beacon reports to.
    const cfBeacon = "https://static.cloudflareinsights.com";
    const cfReport = "https://cloudflareinsights.com";

    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' ${cfBeacon}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      `connect-src 'self' ${cfReport}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // Clickjacking: the app must never be framed. `frame-ancestors 'none'`
          // in the CSP is the modern form; this covers browsers that predate it.
          { key: "X-Frame-Options", value: "DENY" },
          // No MIME sniffing — an uploaded file echoed back cannot be coaxed
          // into executing as script.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Send only the origin off-site, never the full path — a grant id or
          // a token in a URL must not leak in a Referer.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Powerful features nothing here uses, denied to everyone.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default config;
