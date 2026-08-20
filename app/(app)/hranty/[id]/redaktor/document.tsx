"use client";

import { useActionState, useRef, useState } from "react";
import { Check, Pencil, RefreshCw, ScanText, Sparkles, X } from "lucide-react";

import type { ConceptView } from "../../../../../packages/db/concepts";
import { SECTION_SOURCE_LABEL_UK } from "../../../../../packages/schemas/concept";
import { NOUN_UK, countUk } from "../../../../../packages/schemas/locale-uk";
import {
  CATEGORY_LABEL_UK,
  spansFor,
  type Finding,
} from "../../../../../packages/schemas/writing-checks";
import {
  applyFindingAction,
  approveSectionAction,
  generateAction,
  reviewDocumentAction,
  saveSectionAction,
  type DocumentReviewResult,
  type EditorResult,
} from "./actions";

/**
 * The concept as one document.
 *
 * It was eight cards, each with its own text, its own buttons and its own
 * review. That is the shape of the data, not the shape of the work: a concept
 * note is read as one argument, and eight boxes made it impossible to see
 * whether the goal answered the problem two boxes above it.
 *
 * So the page is one document now — headings and prose, the way a reviewer at a
 * foundation will read it — and the per-section machinery moved into two
 * quieter places: controls that appear on the section you are pointing at, and
 * a rail of findings beside the text.
 *
 * What did **not** move is the per-section state. A section a model wrote and
 * nobody has read is still a distinct thing from one a person has been through,
 * because `human-in-the-loop` turns on that distinction and one big textarea
 * would erase it. The document is a presentation of eight rows, not a
 * replacement for them.
 */
export function ConceptDocument({
  grantId,
  concept,
}: {
  grantId: string;
  concept: ConceptView;
}) {
  const [reviewState, review, reviewing] = useActionState<DocumentReviewResult, FormData>(
    reviewDocumentAction,
    null,
  );
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);

  const bySection: Record<string, Finding[]> =
    reviewState && reviewState.ok ? reviewState.review.bySection : {};

  const visible = (key: string) =>
    (bySection[key] ?? []).filter((f) => !dismissed.includes(findingId(f)));

  const all = concept.sections.flatMap((s) =>
    visible(s.key).map((f) => ({ sectionKey: s.key, finding: f })),
  );

  const reviewed = reviewState !== null && reviewState.ok;

  return (
    <div className="doc-shell">
      <article className="doc">
        {concept.sections.map((section) => (
          <DocumentSection
            key={section.key}
            grantId={grantId}
            section={section}
            findings={visible(section.key)}
            activeId={active}
            onSelect={setActive}
          />
        ))}
      </article>

      <aside className="doc-rail">
        <div className="doc-rail-inner stack">
          <form action={review}>
            <input type="hidden" name="grantId" value={grantId} />
            <button type="submit" className="btn btn-primary btn-block" disabled={reviewing}>
              <ScanText size={16} aria-hidden="true" />
              {reviewing ? "Перевіряємо…" : "Перевірити весь текст"}
            </button>
          </form>

          {reviewing ? (
            <p className="field-hint">
              Модель працює локально й читає секції по черзі — близько хвилини на всю
              концепцію.
            </p>
          ) : null}

          {reviewState && !reviewState.ok ? (
            <p className="field-error" role="alert">
              {reviewState.message}
            </p>
          ) : null}

          {reviewed && reviewState.review.failed.length > 0 ? (
            <p className="field-error" role="alert">
              Не вдалося перевірити: {reviewState.review.failed.join(", ")}. Решту перевірено.
            </p>
          ) : null}

          {reviewed && all.length === 0 ? (
            <p className="field-hint">
              Порожніх формулювань, задовгих речень і непідтверджених тверджень не знайдено.
              Це не означає, що текст готовий — тільки що цих проблем немає.
            </p>
          ) : null}

          {all.length > 0 ? (
            <>
              <span className="kicker">
                {countUk(all.length, NOUN_UK.finding)}
              </span>
              <div className="stack">
                {all.map(({ sectionKey, finding }) => (
                  <RailCard
                    key={findingId(finding)}
                    grantId={grantId}
                    sectionKey={sectionKey}
                    finding={finding}
                    active={active === findingId(finding)}
                    onSelect={() => setActive(findingId(finding))}
                    onDismiss={() => setDismissed((d) => [...d, findingId(finding)])}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

/**
 * One section of the document.
 *
 * The heading carries the state; the controls appear when the section is
 * hovered or focused. Eight rows of three buttons permanently on screen was the
 * loudest thing on the page, and none of it is what a person came to read.
 */
function DocumentSection({
  grantId,
  section,
  findings,
  activeId,
  onSelect,
}: {
  grantId: string;
  section: ConceptView["sections"][number];
  findings: Finding[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saveState, save, saving] = useActionState<EditorResult, FormData>(
    saveSectionAction,
    null,
  );
  const [, regenerate, regenerating] = useActionState<EditorResult, FormData>(
    generateAction,
    null,
  );
  const [, approve, approving] = useActionState<EditorResult, FormData>(
    approveSectionAction,
    null,
  );

  const isUnreadDraft = section.source === "AI_DRAFT" && section.approvedAt === null;
  const spans = spansFor(findings, section.content);

  return (
    <section className="doc-section" id={`section-${section.key}`}>
      <div className="doc-section-head">
        <h3 className="h3">{section.labelUk}</h3>
        <span className={`tag ${isUnreadDraft ? "tag-state-unknown" : "tag-state-matched"}`}>
          {SECTION_SOURCE_LABEL_UK[section.source]}
        </span>

        <div className="doc-controls">
          {!editing ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setEditing(true)}
              title={`Редагувати: ${section.labelUk}`}
            >
              <Pencil size={13} aria-hidden="true" />
              Редагувати
            </button>
          ) : null}

          {/* Only where it means something. Approving is the act that takes a
              section out of AI_DRAFT, and it is the whole reason the document
              can ever be called reviewed — dropping it in the redesign would
              have left a draft that could never stop being one. */}
          {isUnreadDraft ? (
            <form action={approve}>
              <input type="hidden" name="grantId" value={grantId} />
              <input type="hidden" name="sectionKey" value={section.key} />
              <button
                type="submit"
                className="btn btn-ghost"
                disabled={approving}
                title="Позначити секцію як прочитану"
              >
                <Check size={13} aria-hidden="true" />
                {approving ? "…" : "Прочитав"}
              </button>
            </form>
          ) : null}

          <form action={regenerate}>
            <input type="hidden" name="grantId" value={grantId} />
            <input type="hidden" name="sectionKey" value={section.key} />
            <button
              type="submit"
              className="btn btn-ghost"
              disabled={regenerating}
              title={
                section.source === "AI_DRAFT"
                  ? "Переписати цю секцію"
                  : "Ваш текст збережеться — переписуються лише незаймані секції"
              }
            >
              <RefreshCw size={13} aria-hidden="true" />
              {regenerating ? "…" : "Переписати"}
            </button>
          </form>
        </div>
      </div>

      {section.unsupportedFigures.length > 0 ? (
        <p className="field-error" role="alert">
          Перевірте числа: {section.unsupportedFigures.join(", ")} — їх немає ні у вашому
          профілі, ні в умовах конкурсу.
        </p>
      ) : null}

      {saveState && !saveState.ok ? (
        <p className="field-error" role="alert">
          {saveState.message}
        </p>
      ) : null}

      {editing ? (
        <form action={save} className="stack">
          <input type="hidden" name="grantId" value={grantId} />
          <input type="hidden" name="sectionKey" value={section.key} />
          <textarea
            className="input doc-editor"
            name="content"
            rows={8}
            defaultValue={section.content}
            aria-label={section.labelUk}
          />
          <div className="row">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Check size={14} aria-hidden="true" />
              {saving ? "Зберігаємо…" : "Зберегти"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
              Скасувати
            </button>
          </div>
        </form>
      ) : (
        <MarkedText
          content={section.content}
          spans={spans}
          activeId={activeId}
          onSelect={onSelect}
        />
      )}
    </section>
  );
}

/**
 * The prose, with flagged spans marked and clickable.
 *
 * Sliced at offsets rather than replaced by string, because a phrase can occur
 * twice and a replace would underline the wrong one — pointing a person at a
 * sentence that is fine.
 */
function MarkedText({
  content,
  spans,
  activeId,
  onSelect,
}: {
  content: string;
  spans: ReturnType<typeof spansFor>;
  activeId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  spans.forEach((span, i) => {
    if (span.start > cursor) parts.push(content.slice(cursor, span.start));
    const id = findingId(span.finding);
    parts.push(
      <button
        key={i}
        type="button"
        className={`flag flag-${span.finding.category.toLowerCase()}${
          activeId === id ? " flag-active" : ""
        }`}
        onClick={() => onSelect(activeId === id ? null : id)}
        title={span.finding.whyUk}
      >
        {content.slice(span.start, span.end)}
      </button>,
    );
    cursor = span.end;
  });

  if (cursor < content.length) parts.push(content.slice(cursor));

  return <p className="doc-text">{parts}</p>;
}

/** One finding, beside the text rather than under it. */
function RailCard({
  grantId,
  sectionKey,
  finding,
  active,
  onSelect,
  onDismiss,
}: {
  grantId: string;
  sectionKey: string;
  finding: Finding;
  active: boolean;
  onSelect: () => void;
  onDismiss: () => void;
}) {
  const [state, apply, applying] = useActionState<EditorResult, FormData>(
    applyFindingAction,
    null,
  );
  const ref = useRef<HTMLElement>(null);

  // Only an actual replacement can be applied. For an unsupported claim the
  // advice is about what to find out, and substituting anything would supply
  // exactly the invented fact being reported.
  const replaceable = finding.suggestionUk !== null && finding.category !== "UNSUPPORTED";

  return (
    <article
      ref={ref}
      className={`rail-card${active ? " rail-card-active" : ""}`}
      onClick={onSelect}
    >
      <div className="row">
        <span className={`tag flag-tag flag-${finding.category.toLowerCase()}`}>
          {CATEGORY_LABEL_UK[finding.category]}
        </span>
        <span className="kicker">{finding.source === "RULE" ? "правило" : "AI"}</span>
      </div>

      <p className="rail-quote">«{finding.quote}»</p>
      <p className="card-body">{finding.whyUk}</p>

      {finding.suggestionUk ? (
        <p className="card-body muted">{finding.suggestionUk}</p>
      ) : null}

      {state && !state.ok ? (
        <p className="field-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="row">
        {replaceable ? (
          <form action={apply}>
            <input type="hidden" name="grantId" value={grantId} />
            <input type="hidden" name="sectionKey" value={sectionKey} />
            <input type="hidden" name="quote" value={finding.quote} />
            <input type="hidden" name="replacement" value={finding.suggestionUk ?? ""} />
            <button type="submit" className="btn btn-secondary" disabled={applying}>
              <Check size={13} aria-hidden="true" />
              {applying ? "…" : "Застосувати"}
            </button>
          </form>
        ) : null}

        <button type="button" className="btn btn-ghost" onClick={onDismiss}>
          <X size={13} aria-hidden="true" />
          Не зауваження
        </button>
      </div>
    </article>
  );
}

export function EmptyConcept({
  grantId,
}: {
  grantId: string;
}) {
  const [state, generate, generating] = useActionState<EditorResult, FormData>(
    generateAction,
    null,
  );

  return (
    <div className="empty stack">
      <h2 className="h3">Концепції ще немає</h2>
      <p className="prose">
        Система напише чернетку з восьми секцій на основі вашого профілю та умов цього
        конкурсу. Це саме чернетка: усе, що вона напише, треба прочитати й виправити, і жодна
        секція не вважатиметься готовою, доки ви цього не зробите.
      </p>
      <p className="prose muted">
        Вона не вигадуватиме цифр, партнерів чи досвіду, яких немає у вашому профілі. Там, де
        даних бракує, у тексті буде видима позначка «потребує уточнення» — її швидше
        заповнити, ніж шукати вигадане число, що виглядає як справжнє.
      </p>

      {state && !state.ok ? (
        <p className="field-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <form action={generate}>
        <input type="hidden" name="grantId" value={grantId} />
        <button type="submit" className="btn btn-primary" disabled={generating}>
          <Sparkles size={16} aria-hidden="true" />
          {generating ? "Пишемо чернетку…" : "Створити чернетку концепції"}
        </button>
      </form>
      <p className="field-hint">Це займає близько хвилини — модель працює локально.</p>
    </div>
  );
}

/** Stable enough to dismiss one finding without dismissing its twin. */
function findingId(finding: Finding): string {
  return `${finding.category}:${finding.quote}`;
}
