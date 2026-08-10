import Link from "next/link";
import {
  Building2,
  FileText,
  Lightbulb,
  ListChecks,
  LogOut,
  Search,
} from "lucide-react";

import { BetaBanner } from "../components/beta";
import { requireDb } from "../lib/session";
import { signOutAction } from "../(auth)/actions";

/**
 * Routes are Ukrainian, not English with a translation layer over them. The
 * interface is Ukrainian-first (see the ua-locale skill), and a URL a grant
 * manager can read is part of that.
 */
/**
 * `ready` is what stops the menu lying.
 *
 * Four of these five routes do not exist yet, and until now clicking them gave
 * a 404 — which during trial operation reads as a broken product rather than an
 * unfinished one. They stay visible, because someone deciding whether this tool
 * is worth their time should see where it is going, but they are not links.
 */
const NAV: { href: string; label: string; Icon: typeof Building2; ready: boolean }[] = [
  { href: "/profil", label: "Профіль організації", Icon: Building2, ready: true },
  { href: "/mozhlyvosti", label: "Можливості", Icon: Search, ready: false },
  { href: "/kontseptsii", label: "Концепції", Icon: Lightbulb, ready: false },
  { href: "/zayavky", label: "Заявки", Icon: FileText, ready: false },
  { href: "/vymohy", label: "Вимоги донора", Icon: ListChecks, ready: false },
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

      <BetaBanner />

      <div className="shell-body">
        <nav className="nav" aria-label="Основна навігація">
          {NAV.map(({ href, label, Icon, ready }) =>
            ready ? (
              <Link key={href} href={href}>
                <Icon size={16} aria-hidden="true" />
                {label}
              </Link>
            ) : (
              <span key={href} className="nav-pending" aria-disabled="true">
                <Icon size={16} aria-hidden="true" />
                {label}
                <span className="tag tag-outline">скоро</span>
              </span>
            ),
          )}
        </nav>

        <main className="shell-main">{children}</main>
      </div>
    </div>
  );
}
