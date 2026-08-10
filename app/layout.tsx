import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Grant Assistant",
  description:
    "Пошук релевантних грантів для українських НУО з поясненням, чому саме вони підходять.",
};

/**
 * Root layout: the document only.
 *
 * The application shell and its navigation live in `(app)/layout.tsx`, which is
 * also where the session is required. Sign-in and registration sit in `(auth)`
 * and deliberately render without navigation — offering links to screens the
 * visitor cannot open yet is a small lie.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
