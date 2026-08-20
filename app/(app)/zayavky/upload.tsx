"use client";

import { useActionState } from "react";
import { FileUp } from "lucide-react";

import { createCallFromFileAction, type UploadCallResult } from "./actions";

/**
 * A call that arrived by email rather than through a source.
 *
 * The product found grants, and only grants it found could be worked on — which
 * left out the ones that often matter most: a donor mails guidelines for a
 * closed competition, or an invitation that was never published anywhere.
 *
 * Reading the PDF produces the same kind of record ingestion produces, so
 * everything downstream — eligibility, the concept, the reviewer — works
 * unchanged.
 */
export function UploadCall() {
  const [state, submit, pending] = useActionState<UploadCallResult, FormData>(
    createCallFromFileAction,
    null,
  );

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="h3">Конкурс, який ви отримали напряму</h2>
      </div>

      <p className="prose muted">
        Донор надіслав умови поштою, і в стрічці цього конкурсу немає? Завантажте PDF або
        документ — система прочитає умови й відкриє редактор. Такий конкурс бачите{" "}
        <strong>тільки ви</strong>: він не потрапляє до стрічок інших організацій.
      </p>

      {state && !state.ok ? (
        <p className="field-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <form action={submit} className="row">
        <label className="field assistant-field">
          <span className="field-label">Умови конкурсу</span>
          <input
            className="input"
            type="file"
            name="file"
            accept=".pdf,.docx,.doc,.txt"
            required
          />
          <span className="field-hint">PDF, DOCX, DOC або TXT, до 20 МБ</span>
        </label>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          <FileUp size={16} aria-hidden="true" />
          {pending ? "Читаємо умови…" : "Прочитати й відкрити редактор"}
        </button>
      </form>

      {pending ? (
        <p className="field-hint">Модель працює локально — на документ іде близько хвилини.</p>
      ) : null}
    </section>
  );
}
