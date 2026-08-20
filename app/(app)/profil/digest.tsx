"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";

import { setDigestAction, type ActionResult } from "./actions";

/**
 * The digest preference.
 *
 * Off unless someone turns it on. An NGO that never asked for mail and receives
 * it has been spammed by a tool it trusted with its statute — and the copy says
 * what the message will and will not contain, because "we may send you updates"
 * is not consent to anything in particular.
 */
export function DigestPreference({ enabled }: { enabled: boolean }) {
  const [state, save, saving] = useActionState<ActionResult | null, FormData>(
    setDigestAction,
    null,
  );

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="h3">Щотижневий лист</h2>
        <Mail size={16} aria-hidden="true" />
      </div>

      <p className="prose muted">
        Раз на тиждень — перелік нових конкурсів, що потрапили до вашої стрічки: назва, донор,
        термін подання. <strong>Без оцінки прийнятності, без даних вашого профілю й без тексту
        заявок</strong> — вони не залишають нашої інфраструктури. Пояснення, чому саме ці
        конкурси, лишається у застосунку.
      </p>

      {state && !state.ok ? (
        <p className="field-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <form action={save}>
        <label className="radio">
          <input
            type="checkbox"
            name="digestOptIn"
            defaultChecked={enabled}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            disabled={saving}
          />
          <span className="field-label">
            Надсилати щотижневий перелік нових можливостей
          </span>
        </label>
      </form>

      <p className="field-hint">
        Вимкнути можна тут або за посиланням у будь-якому листі — без входу в систему.
      </p>
    </section>
  );
}
