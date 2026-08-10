import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  ClipboardCheck,
  FileText,
  Lightbulb,
  ListChecks,
  Search,
} from "lucide-react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Grant Assistant",
  description:
    "Пошук релевантних грантів для українських НУО з поясненням, чому саме вони підходять.",
};

/**
 * Routes are Ukrainian, not English with a translation layer over them. The
 * interface is Ukrainian-first (see the ua-locale skill), and a URL a grant
 * manager can read is part of that.
 */
const NAV = [
  { href: "/profil", label: "Профіль організації", Icon: Building2 },
  { href: "/mozhlyvosti", label: "Можливості", Icon: Search },
  { href: "/kontseptsii", label: "Концепції", Icon: Lightbulb },
  { href: "/zayavky", label: "Заявки", Icon: FileText },
  { href: "/vymohy", label: "Вимоги донора", Icon: ListChecks },
  { href: "/dzherela", label: "Джерела", Icon: ClipboardCheck },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body>
        <div className="shell">
          <header className="shell-head">
            <Link href="/profil" className="wordmark">
              Grant Assistant
            </Link>
            <span className="kicker">для українських громадських організацій</span>
          </header>

          <div className="shell-body">
            <nav className="nav" aria-label="Основна навігація">
              {NAV.map(({ href, label, Icon }) => (
                <Link key={href} href={href}>
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </nav>

            <main className="shell-main">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
