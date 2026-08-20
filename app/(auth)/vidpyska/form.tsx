"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CircleCheck, CircleX, MailX } from "lucide-react";

import { unsubscribeAction, type UnsubscribeResult } from "./actions";

/**
 * One button, and the answer after it.
 *
 * The button is the whole point — see `actions.ts`. It costs the person one
 * click and it is the difference between an unsubscribe they asked for and one
 * a mail scanner performed for them.
 */
export function UnsubscribeForm({ token }: { token: string }) {
  const [state, submit, pending] = useActionState<UnsubscribeResult, FormData>(
    unsubscribeAction,
    null,
  );

  if (state) {
    return (
      <>
        <h1 className="h1">{state.done ? "Ви відписані" : "Посилання не спрацювало"}</h1>
        <p className="prose">
          {state.done ? (
            <>
              <CircleCheck size={14} aria-hidden="true" /> Більше не надсилатимемо
              щотижневий перелік можливостей. Обліковий запис і всі ваші дані лишаються без
              змін — стрічка й далі доступна у застосунку.
            </>
          ) : (
            <>
              <CircleX size={14} aria-hidden="true" /> Не вдалося розпізнати посилання.
              Можливо, воно неповне після копіювання. Розсилку можна вимкнути в профілі.
            </>
          )}
        </p>
        <p className="prose muted">
          <Link href="/profil">Перейти до профілю</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="h1">Відписатися від розсилки</h1>
      <p className="prose">
        Щотижневий перелік нових конкурсів більше не надходитиме. Обліковий запис, профіль і
        стрічка у застосунку лишаються без змін.
      </p>

      <form action={submit}>
        <input type="hidden" name="t" value={token} />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          <MailX size={16} aria-hidden="true" />
          {pending ? "Відписуємо…" : "Відписатися"}
        </button>
      </form>

      <p className="prose muted">
        <Link href="/profil">Передумали? Перейти до профілю</Link>
      </p>
    </>
  );
}
