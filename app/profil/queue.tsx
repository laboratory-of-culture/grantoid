"use client";

import { useActionState, useState } from "react";
import { Check, FileText, Pencil, X } from "lucide-react";

import {
  acceptCandidateAction,
  rejectCandidateAction,
  type ActionResult,
} from "./actions";

export type QueueItem = {
  id: string;
  key: string;
  labelUk: string;
  state: string;
  valueText: string;
  quote: string;
  page: number | null;
  confidence: number;
  documentFilename: string;
  currentValue: string | null;
  currentState: string | null;
};

/**
 * The review queue.
 *
 * The shape of a row is the argument: the proposed value on one side, the
 * sentence it was read from on the other, and the document it came from named
 * underneath. A reviewer who cannot see the source is not reviewing, and
 * `org-knowledge-base` says a fact without provenance does not enter the
 * knowledge base at all.
 */
export function ConfirmationQueue({ items }: { items: QueueItem[] }) {
  const [acceptState, accept] = useActionState<ActionResult | null, FormData>(
    acceptCandidateAction,
    null,
  );
  const [rejectState, reject] = useActionState<ActionResult | null, FormData>(
    rejectCandidateAction,
    null,
  );

  if (items.length === 0) return null;

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="h3">Факти на перевірку</h2>
        <span className="kicker">{items.length}</span>
      </div>

      <p className="prose muted">
        Це те, що вдалося прочитати у ваших документах. Нічого з цього не
        потрапить до заявки, поки ви не підтвердите — і кожен факт показано разом
        із реченням, з якого його взято.
      </p>

      {acceptState && !acceptState.ok ? (
        <p className="field-error" role="alert">
          {acceptState.message}
        </p>
      ) : null}
      {rejectState && !rejectState.ok ? (
        <p className="field-error" role="alert">
          {rejectState.message}
        </p>
      ) : null}

      <div className="stack">
        {items.map((item) => (
          <QueueRow key={item.id} item={item} accept={accept} reject={reject} />
        ))}
      </div>
    </section>
  );
}

function QueueRow({
  item,
  accept,
  reject,
}: {
  item: QueueItem;
  accept: (formData: FormData) => void;
  reject: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <article className="card">
      <span className="card-kicker kicker">{item.labelUk}</span>

      <div className="candidate">
        <div className="stack">
          {item.state === "EXPLICIT_NEGATIVE" ? (
            <span className="tag tag-outline">Підтверджено: немає</span>
          ) : null}

          <form action={accept} className="stack">
            <input type="hidden" name="id" value={item.id} />
            {editing ? (
              <label className="field">
                <span className="field-label">Виправте значення</span>
                <input
                  className="input"
                  name="value"
                  defaultValue={item.valueText}
                  autoFocus
                />
              </label>
            ) : (
              <p className="card-title">{item.valueText}</p>
            )}

            {item.currentValue ? (
              <p className="field-hint">
                Зараз у профілі: {item.currentValue}. Підтвердження замінить це
                значення.
              </p>
            ) : null}

            <div className="row">
              <button type="submit" className="btn btn-primary">
                <Check size={14} aria-hidden="true" />
                {editing ? "Зберегти й підтвердити" : "Підтвердити"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditing((v) => !v)}
              >
                <Pencil size={14} aria-hidden="true" />
                {editing ? "Скасувати виправлення" : "Виправити"}
              </button>
            </div>
          </form>

          <form action={reject}>
            <input type="hidden" name="id" value={item.id} />
            <button type="submit" className="btn btn-ghost">
              <X size={14} aria-hidden="true" />
              Це не так
            </button>
          </form>
        </div>

        <div className="stack">
          <blockquote className="quote">
            {item.quote}
            <span className="quote-source">
              <FileText size={12} aria-hidden="true" /> {item.documentFilename}
              {item.page !== null ? `, с. ${item.page}` : ""}
            </span>
          </blockquote>
        </div>
      </div>
    </article>
  );
}
