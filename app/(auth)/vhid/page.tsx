"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LogIn } from "lucide-react";

import { FormError, useFormErrorId } from "../../components/form-error";
import { signInAction, type AuthResult } from "../actions";

export default function SignInPage() {
  const [state, action, pending] = useActionState<AuthResult, FormData>(signInAction, null);
  // Both fields point at the one error, because the message deliberately does
  // not say which of them was wrong — telling an attacker whether an address is
  // registered is worse than the small loss in precision.
  const error = useFormErrorId(state !== null && !state.ok);

  return (
    <div className="auth-panel">
      <span className="kicker">Вхід</span>
      <h1 className="h1">З поверненням</h1>

      <form action={action} className="stack">
        <label className="field">
          <span className="field-label">Електронна пошта</span>
          <input
            className="input"
            type="email"
            name="email"
            autoComplete="email"
            required
            autoFocus
            {...error.field}
          />
        </label>

        <label className="field">
          <span className="field-label">Пароль</span>
          <input
            className="input"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            {...error.field}
          />
        </label>

        {state && !state.ok ? <FormError id={error.id}>{state.message}</FormError> : null}

        <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
          <LogIn size={16} aria-hidden="true" />
          {pending ? "Входимо…" : "Увійти"}
        </button>
      </form>

      <p className="prose muted">
        Ще немає облікового запису? <Link href="/reyestratsiya">Зареєструйте організацію</Link>.
      </p>

      {/* Readable before signing up, which is the only time it is useful for
          deciding whether to. */}
      <p className="field-hint">
        <Link href="/pryvatnist">Політика приватності</Link> — документи не залишають нашої
        інфраструктури.
      </p>
    </div>
  );
}
