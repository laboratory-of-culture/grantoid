import { UnsubscribeForm } from "./form";

export const dynamic = "force-dynamic";

/**
 * Unsubscribe, without signing in.
 *
 * In the `(auth)` group deliberately: a person who wants mail to stop is not in
 * the mood to remember a password, and a link that demands one gets the message
 * reported as spam instead — which costs the sender far more than an unguessable
 * token does.
 *
 * Rendering this page changes nothing. The write happens on the POST behind the
 * button, because mail-security scanners fetch every link in a message before
 * anyone reads it and a GET that unsubscribes hands them that decision. Mail
 * clients that support RFC 8058 still offer their own one-click control — the
 * `List-Unsubscribe-Post` header in `mail.ts` — so the button is the fallback
 * path, not the only one.
 *
 * The token stays valid after use, so a second visit says «ви відписані» rather
 * than «посилання недійсне», which reads like the unsubscribe failed.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;

  return (
    <div className="auth-panel">
      <span className="kicker">Розсилка</span>
      <UnsubscribeForm token={t ?? ""} />
    </div>
  );
}
