"use client";

import Link from "next/link";
import { useActionState } from "react";
import { UserPlus } from "lucide-react";

import { registerAction, type AuthResult } from "../actions";
// From constants, not password.ts: the latter imports node:crypto, and a client
// component pulling a single number out of it drags Node's crypto surface into
// the browser bundle and fails the build.
import { MIN_PASSWORD_LENGTH } from "../../../packages/auth/constants";

export default function RegisterPage() {
  const [state, action, pending] = useActionState<AuthResult, FormData>(registerAction, null);

  return (
    <div className="auth-panel">
      <span className="kicker">Реєстрація</span>
      <h1 className="h1">Створіть профіль організації</h1>

      <p className="prose muted">
        Профіль заповнюється поступово. Незаповнені поля не блокують пошук —
        вони роблять частину умов «невідомими», і ви побачите, на яке саме
        питання варто відповісти, щоб перевірити конкретний грант.
      </p>

      <form action={action} className="stack">
        <label className="field">
          <span className="field-label">Назва організації</span>
          <input
            className="input"
            name="organizationName"
            required
            autoFocus
            placeholder="Громадська організація «Пороги»"
          />
          <span className="field-hint">Як вона зазначена в реєстраційних документах</span>
        </label>

        <label className="field">
          <span className="field-label">Ваше імʼя</span>
          <input className="input" name="displayName" autoComplete="name" />
          <span className="field-hint">Необовʼязково</span>
        </label>

        <label className="field">
          <span className="field-label">Електронна пошта</span>
          <input className="input" type="email" name="email" autoComplete="email" required />
        </label>

        <label className="field">
          <span className="field-label">Пароль</span>
          <input
            className="input"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
          <span className="field-hint">
            Щонайменше {MIN_PASSWORD_LENGTH} символів. Довга фраза надійніша за
            короткий набір символів.
          </span>
        </label>

        {state && !state.ok ? (
          <p className="field-error" role="alert">
            {state.message}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
          <UserPlus size={16} aria-hidden="true" />
          {pending ? "Створюємо…" : "Створити організацію"}
        </button>
      </form>

      <p className="prose muted">
        Уже маєте обліковий запис? <Link href="/vhid">Увійдіть</Link>.
      </p>
    </div>
  );
}
