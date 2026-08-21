"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Download, Pencil, RefreshCw, ScanText, Sparkles, X } from "lucide-react";

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
  approveConceptAction,
  generateAction,
  reviewDocumentAction,
  saveSectionAction,
  type DocumentReviewResult,
  type EditorResult,
} from "./actions";

/**
 * The concept as one document.
 *
 * It was eight cards, each with its own text, its own buttons, its own review
 * and its own confirmation. That is the shape of the data, not of the work: a
 * concept note is read as one argument, and eight boxes made it impossible to
 * see whether the goal answered the problem two boxes above it.
 *
 * Three things changed once it became one document, and each removed something
 * a person had to do eight times:
 *
 *   - **One confirmation.** Nobody reads a concept note paragraph by paragraph
 *     and signs off each one. The per-section `approvedAt` is still stored —
 *     `human-in-the-loop` turns on the distinction between text a model wrote
 *     and text a person has been through — but one decision now sets all of it.
 *   - **Suggestions where the problem is.** A finding used to live in a rail
 *     beside the text, so reading it meant looking away from the sentence it
 *     was about. Now the flagged words are underlined and clicking them opens
 *     the suggestion over the spot, with what to change and why.
 *   - **The file is always available.** It used to refuse while any section was
 *     an unread draft. Refusing does not keep a draft out of a donor's inbox;
 *     it makes people retype the text into Word, where nothing carries the
 *     warning at all. The warning went into the file instead.
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
  const [approveState, approve, approving] = useActionState<EditorResult, FormData>(
    approveConceptAction,
    null,
  );
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const bySection: Record<string, Finding[]> =
    reviewState && reviewState.ok ? reviewState.review.bySection : {};

  const visible = (key: string) =>
    (bySection[key] ?? []).filter((f) => !dismissed.includes(findingId(f)));

  const total = concept.sections.reduce((n, s) => n + visible(s.key).length, 0);
  const reviewed = reviewState !== null && reviewState.ok;

  // Counted from the sections themselves rather than from the draft status,
  // which can lag a regeneration.
  const unread = concept.sections.filter(
    (s) => s.source === "AI_DRAFT" && s.approvedAt === null,
  ).length;

  return (
    <div className="doc-shell">
      {/* One bar, above the text, carrying the three things you do to a whole
          document: check it, confirm it, take it away. */}
      <div className="doc-bar">
        <form action={review}>
          <input type="hidden" name="grantId" value={grantId} />
          <button type="submit" className="btn btn-secondary" disabled={reviewing}>
            <ScanText size={15} aria-hidden="true" />
            {reviewing ? "Перевіряємо…" : "Перевірити весь текст"}
          </button>
        </form>

        {unread > 0 ? (
          <form action={approve}>
            <input type="hidden" name="grantId" value={grantId} />
            <button type="submit" className="btn btn-primary" disabled={approving}>
              <Check size={15} aria-hidden="true" />
              {approving ? "Позначаємо…" : "Я прочитав усю концепцію"}
            </button>
          </form>
        ) : (
          <span className="tag tag-state-matched">
            <Check size={13} aria-hidden="true" />
            Прочитано людиною
          </span>
        )}

        {/* Never disabled. The document leaves whenever it is asked for; an
            unread draft is stamped inside the file rather than held back. */}
        <a href={`/hranty/${grantId}/redaktor/eksport`} className="btn btn-ghost" download>
          <Download size={15} aria-hidden="true" />
          Зберегти як файл (RTF)
        </a>

        <span className="doc-bar-end kicker">
          {reviewing
            ? "модель читає секції по черзі"
            : reviewed
              ? total > 0
                ? countUk(total, NOUN_UK.finding)
                : "зауважень не знайдено"
              : unread > 0
                ? `${countUk(unread, NOUN_UK.section)} ще не прочитано`
                : ""}
        </span>
      </div>

      {unread > 0 ? (
        <p className="field-hint">
          У файлі, збереженому зараз, буде помітка, що {countUk(unread, NOUN_UK.section)}{" "}
          написала модель і їх ще ніхто не перевіряв.
        </p>
      ) : null}

      {approveState && !approveState.ok ? (
        <p className="field-error" role="alert">
          {approveState.message}
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

      {reviewed && total === 0 ? (
        <p className="field-hint">
          Порожніх формулювань, задовгих речень і непідтверджених тверджень не знайдено. Це
          не означає, що текст готовий — тільки що цих проблем немає.
        </p>
      ) : null}

      <article className="doc">
        {concept.sections.map((section) => (
          <DocumentSection
            key={section.key}
            grantId={grantId}
            section={section}
            findings={visible(section.key)}
            openId={open}
            onOpen={setOpen}
            onDismiss={(id) => {
              setDismissed((d) => [...d, id]);
              setOpen(null);
            }}
          />
        ))}
      </article>
    </div>
  );
}

/**
 * One section of the document.
 *
 * The heading carries the state; the controls appear on the section you are
 * pointing at. No confirmation here any more — that moved to the bar, where a
 * decision about the whole note belongs.
 */
function DocumentSection({
  grantId,
  section,
  findings,
  openId,
  onOpen,
  onDismiss,
}: {
  grantId: string;
  section: ConceptView["sections"][number];
  findings: Finding[];
  openId: string | null;
  onOpen: (id: string | null) => void;
  onDismiss: (id: string) => void;
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

  // Same rule as the profile editor: close on success, stay open on failure so
  // the error has somewhere to live.
  useEffect(() => {
    if (saveState?.ok) setEditing(false);
  }, [saveState]);

  const isUnreadDraft = section.source === "AI_DRAFT" && section.approvedAt === null;
  const spans = spansFor(findings, section.content);

  return (
    <section className="doc-section" id={`section-${section.key}`}>
      <div className="doc-section-head">
        <h3 className="h3">{section.labelUk}</h3>
        {/* The label and the colour have to agree. Printing the source column
            straight through showed «Чернетка AI» in the colour that means done
            on a section somebody had already approved. */}
        <span className={`tag ${isUnreadDraft ? "tag-state-unknown" : "tag-state-matched"}`}>
          {isUnreadDraft
            ? SECTION_SOURCE_LABEL_UK.AI_DRAFT
            : section.approvedAt !== null && section.source === "AI_DRAFT"
              ? "Прочитано"
              : SECTION_SOURCE_LABEL_UK[section.source]}
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
          grantId={grantId}
          sectionKey={section.key}
          content={section.content}
          spans={spans}
          openId={openId}
          onOpen={onOpen}
          onDismiss={onDismiss}
        />
      )}
    </section>
  );
}

/**
 * The prose, with flagged spans underlined and clickable.
 *
 * Sliced at offsets rather than replaced by string, because a phrase can occur
 * twice and a replace would underline the wrong one — pointing a person at a
 * sentence that is fine.
 *
 * The popover is a sibling of the underlined span inside a positioned wrapper,
 * not a floating layer placed by measurement. Measuring means recomputing on
 * every scroll and resize, and getting it wrong puts the explanation on top of
 * the sentence it explains.
 */
function MarkedText({
  grantId,
  sectionKey,
  content,
  spans,
  openId,
  onOpen,
  onDismiss,
}: {
  grantId: string;
  sectionKey: string;
  content: string;
  spans: ReturnType<typeof spansFor>;
  openId: string | null;
  onOpen: (id: string | null) => void;
  onDismiss: (id: string) => void;
}) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  spans.forEach((span, i) => {
    if (span.start > cursor) parts.push(content.slice(cursor, span.start));
    const id = findingId(span.finding);
    const isOpen = openId === id;

    parts.push(
      <span className="flag-anchor" key={i}>
        <button
          type="button"
          className={`flag flag-${span.finding.category.toLowerCase()}${
            isOpen ? " flag-active" : ""
          }`}
          aria-expanded={isOpen}
          onClick={() => onOpen(isOpen ? null : id)}
        >
          {content.slice(span.start, span.end)}
        </button>
        {isOpen ? (
          <Suggestion
            grantId={grantId}
            sectionKey={sectionKey}
            finding={span.finding}
            onClose={() => onOpen(null)}
            onDismiss={() => onDismiss(id)}
          />
        ) : null}
      </span>,
    );
    cursor = span.end;
  });

  if (cursor < content.length) parts.push(content.slice(cursor));

  return <p className="doc-text">{parts}</p>;
}

/**
 * What is wrong, why, and what to put instead — over the words it is about.
 *
 * The «why» is not decoration. A suggestion with no reason trains a person to
 * accept every one of them, which is the opposite of what a reviewer is for:
 * the model is often wrong, and the reason is what lets somebody see that.
 */
function Suggestion({
  grantId,
  sectionKey,
  finding,
  onClose,
  onDismiss,
}: {
  grantId: string;
  sectionKey: string;
  finding: Finding;
  onClose: () => void;
  onDismiss: () => void;
}) {
  const [state, apply, applying] = useActionState<EditorResult, FormData>(
    applyFindingAction,
    null,
  );
  const ref = useRef<HTMLDivElement>(null);

  // Escape closes it, because a popover you can only dismiss with the mouse is
  // one a keyboard user is trapped behind.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Only an actual replacement can be applied. For an unsupported claim the
  // advice is about what to find out, and substituting anything would supply
  // exactly the invented fact being reported.
  const replaceable = finding.suggestionUk !== null && finding.category !== "UNSUPPORTED";

  return (
    <div className="suggestion" role="dialog" tabIndex={-1} ref={ref}>
      <div className="row">
        <span className={`tag flag-tag flag-${finding.category.toLowerCase()}`}>
          {CATEGORY_LABEL_UK[finding.category]}
        </span>
        <span className="kicker">{finding.source === "RULE" ? "правило" : "AI"}</span>
        <button
          type="button"
          className="btn btn-ghost suggestion-close"
          onClick={onClose}
          aria-label="Закрити"
        >
          <X size={13} aria-hidden="true" />
        </button>
      </div>

      <p className="card-body">{finding.whyUk}</p>

      {finding.suggestionUk ? (
        <p className="suggestion-replacement">{finding.suggestionUk}</p>
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
            <button type="submit" className="btn btn-primary" disabled={applying}>
              <Check size={13} aria-hidden="true" />
              {applying ? "…" : "Замінити"}
            </button>
          </form>
        ) : null}

        <button type="button" className="btn btn-ghost" onClick={onDismiss}>
          Це не помилка
        </button>
      </div>
    </div>
  );
}

export function EmptyConcept({ grantId }: { grantId: string }) {
  const [state, generate, generating] = useActionState<EditorResult, FormData>(
    generateAction,
    null,
  );

  return (
    <div className="empty stack">
      <h2 className="h3">Концепції ще немає</h2>
      <p className="prose">
        Система напише чернетку з восьми секцій на основі вашого профілю та умов цього
        конкурсу. Це саме чернетка: усе, що вона напише, треба прочитати й виправити.
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
