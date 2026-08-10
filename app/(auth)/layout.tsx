import Link from "next/link";

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
          Grant Assistant
        </Link>
        <span className="kicker">для українських громадських організацій</span>
      </header>
      <main className="auth-main">{children}</main>
    </div>
  );
}
