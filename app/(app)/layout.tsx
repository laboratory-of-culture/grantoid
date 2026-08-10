import Link from "next/link";
import {
  Building2,
  FileText,
  Lightbulb,
  ListChecks,
  LogOut,
  Search,
} from "lucide-react";

import { requireDb } from "../lib/session";
import { signOutAction } from "../(auth)/actions";

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
];
// "Джерела" is deliberately absent: the source registry is operator tooling,
// not something an NGO manages, and a nav item that redirects on click is worse
// than no nav item.

/**
 * Guarded once, here, rather than in each page.
 *
 * A page that forgets the check renders someone else's data or crashes, and
 * neither is a failure mode worth leaving to memory.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireDb();

  return (
    <div className="shell">
      <header className="shell-head">
        <Link href="/profil" className="wordmark">
          Grant Assistant
        </Link>
        <span className="kicker">{user.organizationName}</span>
        <form action={signOutAction} className="shell-head-end">
          <button type="submit" className="btn btn-ghost">
            <LogOut size={14} aria-hidden="true" />
            Вийти
          </button>
        </form>
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
  );
}
