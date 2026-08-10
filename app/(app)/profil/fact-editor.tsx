"use client";

import { useActionState, useState } from "react";
import { Check, CircleMinus, Pencil, Undo2 } from "lucide-react";

import { answerFactAction, clearFactAction, type ActionResult } from "./actions";
import type { FactValueKind } from "../../../packages/schemas/fact-registry";

export type FactEditorProps = {
  factKey: string;
  kind: FactValueKind;
  questionUk: string;
  currentValue: string | null;
  state: string;
};

/**
 * Answering one profile question.
 *
 * Two ways out, and both matter. "Зберегти" records what the organization has;
 * "У нас цього немає" records that it does not — `EXPLICIT_NEGATIVE`, the only
 * state that lets the system say NOT_ELIGIBLE with any confidence (D4).
 *
 * Without the second button an organization can only ever move a field from
 * unknown to a value, and every requirement it genuinely fails stays
 * permanently uncertain.
 */
export function FactEditor(props: FactEditorProps) {
  const [open, setOpen] = useState(false);
  const [answer, submit, saving] = useActionState<ActionResult | null, FormData>(
    answerFactAction,
    null,
  );
  const [cleared, clear] = useActionState<ActionResult | null, FormData>(
    clearFactAction,
    null,
  );

  const unknown = props.state === "UNKNOWN";

  if (!open) {
    return (
      <div className="row">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
          <Pencil size={14} aria-hidden="true" />
          {unknown ? "Відповісти" : "Змінити"}
        </button>
        {!unknown ? (
          <form action={clear}>
            <input type="hidden" name="key" value={props.factKey} />
            <button type="submit" className="btn btn-ghost" aria-label="Прибрати відповідь">
              <Undo2 size={14} aria-hidden="true" />
            </button>
          </form>
        ) : null}
        {cleared && !cleared.ok ? (
          <span className="field-error" role="alert">
            {cleared.message}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <form action={submit} className="stack fact-form">
      <input type="hidden" name="key" value={props.factKey} />

      <label className="field">
        <span className="field-label">{props.questionUk}</span>
        <Control kind={props.kind} defaultValue={props.currentValue} />
      </label>

      {answer && !answer.ok ? (
        <p className="field-error" role="alert">
          {answer.message}
        </p>
      ) : null}

      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          <Check size={14} aria-hidden="true" />
          {saving ? "Зберігаємо…" : "Зберегти"}
        </button>

        {/* The affordance that makes EXPLICIT_NEGATIVE reachable at all. */}
        <button
          type="submit"
          name="negative"
          value="1"
          className="btn btn-secondary"
          disabled={saving}
        >
          <CircleMinus size={14} aria-hidden="true" />
          У нас цього немає
        </button>

        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Скасувати
        </button>
      </div>

      <p className="field-hint">
        «У нас цього немає» — це теж відповідь. Вона дозволяє точно виключити
        гранти з такою вимогою, замість того щоб залишати їх невизначеними.
      </p>
    </form>
  );
}

function Control({
  kind,
  defaultValue,
}: {
  kind: FactValueKind;
  defaultValue: string | null;
}) {
  switch (kind) {
    case "BOOLEAN":
      // Only "так" is a value here; "ні" arrives through the negative button, so
      // that a no is stored as a confirmed negative rather than as the string
      // "ні" in a text field.
      return (
        <select className="input" name="value" defaultValue="так">
          <option value="так">Так</option>
        </select>
      );

    case "DATE":
      return (
        <input
          className="input"
          type="date"
          name="value"
          defaultValue={defaultValue ?? ""}
        />
      );

    case "NUMBER":
      return (
        <input
          className="input"
          type="text"
          inputMode="decimal"
          name="value"
          defaultValue={defaultValue ?? ""}
          placeholder="12 500"
        />
      );

    case "LIST":
      return (
        <>
          <textarea
            className="input"
            name="value"
            rows={4}
            defaultValue={defaultValue?.split("; ").join("\n") ?? ""}
          />
          <span className="field-hint">По одному пункту в рядку</span>
        </>
      );

    case "TEXT":
    default:
      return (
        <input className="input" type="text" name="value" defaultValue={defaultValue ?? ""} />
      );
  }
}
