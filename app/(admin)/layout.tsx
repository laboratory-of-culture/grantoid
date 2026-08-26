import Link from "next/link";

import { Wordmark } from "../components/wordmark";
import { Building2, LogOut, Radio } from "lucide-react";

import { requireAdmin } from "../lib/session";
import { signOutAction } from "../(auth)/actions";

/**
 * Operator area, separate from `(app)`.
 *
 * A separate group because `(app)` requires an organization and an operator has
 * none — the source registry belongs to nobody's NGO, and an operator account
 * with a membership would put a real organization's documents one click away.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <div className="shell">
      <header className="shell-head">
        <Link href="/dzherela" className="wordmark">
          <Wordmark />
        </Link>
        <span className="tag tag-accent">Адміністрування</span>
        <span className="kicker">{user.email}</span>
        <form action={signOutAction} className="shell-head-end">
          <button type="submit" className="btn btn-ghost">
            <LogOut size={14} aria-hidden="true" />
            Вийти
          </button>
        </form>
      </header>

      <div className="shell-body">
        {/* Two destinations, and they answer different questions. The registry
            is about what the product reads; the organizations screen is about
            whether any of it is reaching anybody. `aria-current` is gone: it was
            hard-coded on the sources link and lied on every other page. */}
        <nav className="nav" aria-label="Адміністрування">
          <Link href="/orhanizatsiyi">
            <Building2 size={16} aria-hidden="true" />
            Організації
          </Link>
          <Link href="/dzherela">
            <Radio size={16} aria-hidden="true" />
            Джерела
          </Link>
        </nav>
        <main className="shell-main">{children}</main>
      </div>
    </div>
  );
}
