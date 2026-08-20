import Link from "next/link";
import { Building2, FileText, LogOut, Search } from "lucide-react";

import { BetaBanner } from "../components/beta";
import { requireDb } from "../lib/session";
import { signOutAction } from "../(auth)/actions";

/**
 * Routes are Ukrainian, not English with a translation layer over them. The
 * interface is Ukrainian-first (see the ua-locale skill), and a URL a grant
 * manager can read is part of that.
 */
/**
 * Three entries, and that is the whole product.
 *
 * There used to be five. «Концепції» and «Вимоги донора» are gone for good:
 * neither is work you do in general, and as separate destinations each would
 * have opened on an empty list asking you to pick a grant — the screen you had
 * just come from. Both live in the editor, against one call.
 *
 * «Заявки» came back, for two reasons the editor alone cannot serve. A draft
 * you started last week needs somewhere to be found again. And a call a donor
 * mailed you was never in the feed at all, so an entry point that starts at the
 * feed cannot reach it.
 */
const NAV: { href: string; label: string; Icon: typeof Building2; ready: boolean }[] = [
  { href: "/profil", label: "Профіль організації", Icon: Building2, ready: true },
  { href: "/mozhlyvosti", label: "Можливості", Icon: Search, ready: true },
  // Third, after the feed. The editor was reachable only from an opportunity,
  // which assumed every call comes from a source we crawl. A draft you want to
  // return to, and a call a donor mailed you, both need a door of their own.
  { href: "/zayavky", label: "Заявки", Icon: FileText, ready: true },
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
