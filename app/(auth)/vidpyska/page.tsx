import Link from "next/link";
import { CircleCheck, CircleX } from "lucide-react";

import { unsubscribeByToken } from "../../../packages/notifications/send";

export const dynamic = "force-dynamic";

/**
 * Unsubscribe, without signing in.
 *
 * In the `(auth)` group deliberately: a person who wants mail to stop is not in
 * the mood to remember a password, and a link that demands one gets the message
 * reported as spam instead — which costs the sender far more than an unguessable
 * token does.
 *
 * The token stays valid after use, so a second click says «ви відписані» rather
 * than «посилання недійсне», which reads like the unsubscribe failed.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const done = await unsubscribeByToken(t ?? "");

  return (
    <div className="auth-panel">
      <span className="kicker">Розсилка</span>
      <h1 className="h1">{done ? "Ви відписані" : "Посилання не спрацювало"}</h1>

      <p className="prose">
        {done ? (
          <>
            <CircleCheck size={14} aria-hidden="true" /> Більше не надсилатимемо щотижневий
            перелік можливостей. Обліковий запис і всі ваші дані лишаються без змін — стрічка
            й далі доступна у застосунку.
          </>
        ) : (
          <>
            <CircleX size={14} aria-hidden="true" /> Не вдалося розпізнати посилання. Можливо,
            воно неповне після копіювання. Розсилку можна вимкнути в профілі організації.
          </>
        )}
      </p>

      <p className="prose muted">
        <Link href="/profil">Перейти до профілю</Link>
      </p>
    </div>
  );
}
