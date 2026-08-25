import Link from "next/link";

import { Funders } from "../components/funders";
import { Wordmark } from "../components/wordmark";

/**
 * Sign-in and registration. No navigation: offering links to screens the
 * visitor cannot open yet is a small lie, and the only thing to do here is the
 * one form on the page.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="shell-head">
        <Link href="/vhid" className="wordmark">
          <Wordmark full />
        </Link>
        {/* The tagline, on the one screen where the product introduces itself.
            The signed-in shell shows the organization's own name here instead —
            a person who is already inside does not need to be told what the
            thing is. */}
        <span className="kicker">грантовий асистент зі штучним інтелектом</span>
      </header>
      <main className="auth-main">
        {children}
        <Funders />
      </main>
    </div>
  );
}
