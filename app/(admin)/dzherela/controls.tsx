"use client";

import { useActionState } from "react";
import { Power, RefreshCw, ShieldCheck } from "lucide-react";

import {
  checkSourceAction,
  reviewRobotsAction,
  toggleSourceAction,
  type AdminResult,
} from "./actions";

export function SourceControls({
  id,
  enabled,
  reviewed,
}: {
  id: string;
  enabled: boolean;
  reviewed: boolean;
}) {
  const [checkState, check, checking] = useActionState<AdminResult, FormData>(
    checkSourceAction,
    null,
  );
  const [robotsState, robots, checkingRobots] = useActionState<AdminResult, FormData>(
    reviewRobotsAction,
    null,
  );
  const [toggleState, toggle] = useActionState<AdminResult, FormData>(
    toggleSourceAction,
    null,
  );

  const result = checkState ?? robotsState ?? toggleState;

  return (
    <div className="stack">
      <div className="row">
        <form action={robots}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="btn btn-secondary" disabled={checkingRobots}>
            <ShieldCheck size={14} aria-hidden="true" />
            {checkingRobots ? "Перевіряємо…" : "Перевірити robots.txt"}
          </button>
        </form>

        <form action={toggle}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="btn btn-secondary" disabled={!enabled && !reviewed}>
            <Power size={14} aria-hidden="true" />
            {enabled ? "Вимкнути" : "Увімкнути"}
          </button>
        </form>

        <form action={check}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="btn btn-primary" disabled={!enabled || checking}>
            <RefreshCw size={14} aria-hidden="true" />
            {checking ? "Перевіряємо…" : "Перевірити зараз"}
          </button>
        </form>
      </div>

      {!enabled && !reviewed ? (
        <p className="field-hint">
          Щоб увімкнути джерело, спершу перевірте robots.txt і зафіксуйте
          перегляд умов використання.
        </p>
      ) : null}

      {result ? (
        <p className={result.ok ? "field-hint" : "field-error"} role="status">
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
