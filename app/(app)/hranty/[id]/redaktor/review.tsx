"use client";

import { useActionState, useState } from "react";
import { Check, ScanText, X } from "lucide-react";

import {
  CATEGORY_LABEL_UK,
  spansFor,
  type Finding,
} from "../../../../../packages/schemas/writing-checks";
import {
  applyFindingAction,
  reviewSectionAction,
  type EditorResult,
  type ReviewResult,
} from "./actions";

/**
 * The writing review, shown the way a proofreader shows it.
 *
 * The difference from the assistant is the whole point: the assistant rewrites a
 * section and you accept or discard the result, which means reading a new
 * paragraph and comparing it in your head to the one it replaced. This points at
 * a span and says what is wrong with *that*, and every finding is a separate
 * decision. A person who disagrees with three of four still gets the fourth.
 *
 * Rules run without the model and their findings appear even if the runtime is
 * down, so the check is never all-or-nothing.
 */
export function SectionReview({
  grantId,
  sectionKey,
  content,
}: {
  grantId: string;
  sectionKey: string;
  content: string;
}) {
  const [state, review, reviewing] = useActionState<ReviewResult, FormData>(
    reviewSectionAction,
    null,
  );
  const [dismissed, setDismissed] = useState<string[]>([]);

  const findings =
    state && state.ok && state.review.sectionKey === sectionKey
      ? state.review.findings.filter((f) => !dismissed.includes(findingId(f)))
      : [];

  const spans = spansFor(findings, content);

  return (
    <div className="stack">
      <div className="row">
        <form action={review}>
          <input type="hidden" name="grantId" value={grantId} />
          <input type="hidden" name="sectionKey" value={sectionKey} />
          <button type="submit" className="btn btn-ghost" disabled={reviewing}>
            <ScanText size={14} aria-hidden="true" />
            {reviewing ? "Перевіряємо…" : "Перевірити текст"}
          </button>
        </form>

        {state && state.ok && state.review.sectionKey === sectionKey ? (
          <span className="kicker">
            {findings.length === 0
              ? "зауважень немає"
              : `${findings.length} ${pluralFindings(findings.length)}`}
          </span>
        ) : null}
      </div>

      {state && !state.ok ? (
        <p className="field-error" role="alert">
          {state.message}
        </p>
      ) : null}

      {/* One copy of the text, always. Plain before a review, marked after —
          `white-space: pre-wrap` via .concept-text keeps the model's paragraphs,
          because losing them turns a readable draft into a wall. */}
      <Highlighted content={content} spans={spans} />

      {spans.length > 0 ? (
        <>
          <div className="stack">
            {spans.map(({ finding }) => (
              <FindingCard
                key={findingId(finding)}
                grantId={grantId}
                sectionKey={sectionKey}
                finding={finding}
                onDismiss={() => setDismissed((d) => [...d, findingId(finding)])}
              />
            ))}
          </div>
        </>
      ) : null}

      {state && state.ok && state.review.sectionKey === sectionKey && findings.length === 0 ? (
        <p className="field-hint">
          Порожніх формулювань, задовгих речень і непідтверджених тверджень не знайдено. Це не
          означає, що текст готовий — тільки що ці конкретні проблеми відсутні.
        </p>
      ) : null}
    </div>
  );
}

/**
 * The section with its flagged spans marked.
 *
 * Built by slicing at offsets rather than by replacing text, because a replace
 * would match the first occurrence of a phrase that may appear twice — and the
 * highlight would land on the wrong one, pointing a person at a sentence that
 * is fine.
 */
function Highlighted({
  content,
  spans,
}: {
  content: string;
  spans: ReturnType<typeof spansFor>;
}) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  spans.forEach((span, i) => {
    if (span.start > cursor) parts.push(content.slice(cursor, span.start));
    parts.push(
      <mark key={i} className={`flag flag-${span.finding.category.toLowerCase()}`}>
        {content.slice(span.start, span.end)}
      </mark>,
    );
    cursor = span.end;
  });

  if (cursor < content.length) parts.push(content.slice(cursor));

  return <p className="prose concept-text">{parts}</p>;
}

function FindingCard({
  grantId,
  sectionKey,
  finding,
  onDismiss,
}: {
  grantId: string;
  sectionKey: string;
  finding: Finding;
  onDismiss: () => void;
}) {
  const [state, apply, applying] = useActionState<EditorResult, FormData>(
    applyFindingAction,
    null,
  );

  // Only an actual replacement can be applied. For an unsupported claim the
  // suggestion is advice about what to find out, and there is nothing to
  // substitute — offering a button would invite replacing a fabricated number
  // with a fabricated sentence.
  const replaceable =
    finding.suggestionUk !== null && finding.category !== "UNSUPPORTED";

  return (
    <article className="card stack">
      <div className="row">
        <span className={`tag flag-tag flag-${finding.category.toLowerCase()}`}>
          {CATEGORY_LABEL_UK[finding.category]}
        </span>
        <span className="kicker">{finding.source === "RULE" ? "правило" : "AI"}</span>
      </div>

      <blockquote className="quote">{finding.quote}</blockquote>
      <p className="card-body">{finding.whyUk}</p>

      {finding.suggestionUk ? (
        <p className="card-body muted">{finding.suggestionUk}</p>
      ) : null}

      {state && !state.ok ? (
        <p className="field-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="card-meta">
        {replaceable ? (
          <form action={apply}>
            <input type="hidden" name="grantId" value={grantId} />
            <input type="hidden" name="sectionKey" value={sectionKey} />
            <input type="hidden" name="quote" value={finding.quote} />
            <input type="hidden" name="replacement" value={finding.suggestionUk ?? ""} />
            <button type="submit" className="btn btn-secondary" disabled={applying}>
              <Check size={14} aria-hidden="true" />
              {applying ? "Застосовуємо…" : "Застосувати"}
            </button>
          </form>
        ) : null}

        <button type="button" className="btn btn-ghost" onClick={onDismiss}>
          <X size={14} aria-hidden="true" />
          Не зауваження
        </button>
      </div>
    </article>
  );
}

/** Stable enough to dismiss one finding without dismissing its twin. */
function findingId(finding: Finding): string {
  return `${finding.category}:${finding.quote}`;
}

function pluralFindings(n: number): string {
  const rules = new Intl.PluralRules("uk");
  switch (rules.select(n)) {
    case "one":
      return "зауваження";
    case "few":
      return "зауваження";
    default:
      return "зауважень";
  }
}
