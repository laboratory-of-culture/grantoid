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
export function UnsubscribeForm({ token, known }: { token: string; known: boolean }) {
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

  // An unrecognised token never gets a button. Offering one that is certain to
  // fail wastes a click and, worse, leaves someone believing they unsubscribed.
  if (!known) {
    return (
      <>
        <h1 className="h1">Посилання не спрацювало</h1>
        <p className="prose">
          <CircleX size={14} aria-hidden="true" /> Не вдалося розпізнати посилання. Найчастіше
          це буває, коли адресу скопійовано не повністю. Спробуйте перейти за посиланням із
          листа ще раз або вимкніть розсилку в профілі.
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
      {/* Conditional, not perfective. The first version read «більше не
          надходитиме» above a button nobody had pressed yet, which describes a
          finished state and invites closing the tab. */}
      <p className="prose">
        Натисніть кнопку — і щотижневий перелік нових конкурсів більше не надходитиме.
        Обліковий запис, профіль і стрічка у застосунку лишаться без змін.
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
