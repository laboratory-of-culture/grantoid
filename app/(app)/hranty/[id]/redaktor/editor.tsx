"use client";

import { useActionState, useState } from "react";
import { Check, FileText, RefreshCw, Sparkles } from "lucide-react";

import type { ConceptView } from "../../../../../packages/db/concepts";
import { SECTION_SOURCE_LABEL_UK } from "../../../../../packages/schemas/concept";
import {
  approveSectionAction,
  assistSectionAction,
  generateAction,
  saveSectionAction,
  type AssistResult,
  type EditorResult,
} from "./actions";

type SectionMeta = { key: string; labelUk: string; promptUk: string };

/**
 * The editor.
 *
 * One rule shapes the whole screen: a section a model wrote and nobody has read
 * is visibly different from one a person has been through. That is not a badge
 * in a corner — it is the state the section is in, it decides whether the draft
 * can be called reviewed, and it is why every section carries its own approve
 * action rather than the document carrying one.
 */
export function ConceptEditor({
  grantId,
  concept,
  allSections,
}: {
  grantId: string;
  concept: ConceptView | null;
  allSections: SectionMeta[];
}) {
  const [genState, generate, generating] = useActionState<EditorResult, FormData>(
    generateAction,
    null,
  );

  if (!concept) {
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

        {genState && !genState.ok ? (
          <p className="field-error" role="alert">
            {genState.message}
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

  const byKey = new Map(concept.sections.map((s) => [s.key, s]));

  return (
    <div className="stack">
      <div className="section-head">
        <h2 className="h3">Концепція</h2>
        <span className="kicker">
          {concept.unreviewed.length === 0
            ? "усі секції прочитано"
            : `${concept.unreviewed.length} секцій не прочитано`}
        </span>
      </div>

      {concept.unreviewed.length > 0 ? (
        <p className="prose muted">
          Секції, позначені як чернетка AI, ви ще не переглядали. Прочитайте кожну — виправте
          або підтвердьте. Поки лишається хоч одна непрочитана, концепція не готова до подачі.
        </p>
      ) : null}

      {genState && !genState.ok ? (
        <p className="field-error" role="alert">
          {genState.message}
        </p>
      ) : null}

      <div className="stack">
        {allSections.map((meta) => (
          <SectionCard
            key={meta.key}
            grantId={grantId}
            meta={meta}
            section={byKey.get(meta.key) ?? null}
          />
        ))}
      </div>
    </div>
  );
}

function SectionCard({
  grantId,
  meta,
  section,
}: {
  grantId: string;
  meta: SectionMeta;
  section: ConceptView["sections"][number] | null;
}) {
  const [editing, setEditing] = useState(false);
  const [saveState, save, saving] = useActionState<EditorResult, FormData>(
    saveSectionAction,
    null,
  );
  const [, approve, approving] = useActionState<EditorResult, FormData>(
    approveSectionAction,
    null,
  );
  const [, regenerate, regenerating] = useActionState<EditorResult, FormData>(
    generateAction,
    null,
  );

  const isUnreadDraft = section?.source === "AI_DRAFT" && section.approvedAt === null;

  return (
    <article className="card stack">
      <div className="row">
        <h3 className="card-title">{meta.labelUk}</h3>
        {section ? (
          <span className={`tag ${isUnreadDraft ? "tag-state-unknown" : "tag-state-matched"}`}>
            {isUnreadDraft ? SECTION_SOURCE_LABEL_UK.AI_DRAFT : SECTION_SOURCE_LABEL_UK[section.source]}
          </span>
        ) : (
          <span className="tag tag-outline">не написано</span>
        )}
        {section?.approvedAt ? <span className="tag tag-neutral">прочитано</span> : null}
      </div>

      <p className="field-hint">{meta.promptUk}</p>

      {/* Figures the model produced that neither the profile nor the call
          supports. Named rather than removed: only the organization knows the
          real number, and stripping it would leave broken prose and hide that
          anything was wrong. */}
      {section && section.unsupportedFigures.length > 0 ? (
        <p className="field-error" role="alert">
          Перевірте числа: {section.unsupportedFigures.join(", ")} — їх немає ні у вашому
          профілі, ні в умовах конкурсу. Замініть на власні дані або приберіть.
        </p>
      ) : null}

      {saveState && !saveState.ok ? (
        <p className="field-error" role="alert">
          {saveState.message}
        </p>
      ) : null}

      {editing || !section ? (
        <form action={save} className="stack">
          <input type="hidden" name="grantId" value={grantId} />
          <input type="hidden" name="sectionKey" value={meta.key} />
          <textarea
            className="input"
            name="content"
            rows={10}
            defaultValue={section?.content ?? ""}
            aria-label={meta.labelUk}
          />
          <div className="row">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Check size={14} aria-hidden="true" />
              {saving ? "Зберігаємо…" : "Зберегти"}
            </button>
            {section ? (
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                Скасувати
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <>
          {/* `white-space: pre-wrap` via .concept-text: the model writes
              paragraphs and losing them turns a readable draft into a wall. */}
          <p className="prose concept-text">{section.content}</p>

          <div className="card-meta">
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
              <FileText size={14} aria-hidden="true" />
              Редагувати
            </button>

            {isUnreadDraft ? (
              <form action={approve}>
                <input type="hidden" name="grantId" value={grantId} />
                <input type="hidden" name="sectionKey" value={meta.key} />
                <button type="submit" className="btn btn-secondary" disabled={approving}>
                  <Check size={14} aria-hidden="true" />
                  Прочитав, усе правильно
                </button>
              </form>
            ) : null}

            <form action={regenerate}>
              <input type="hidden" name="grantId" value={grantId} />
              <input type="hidden" name="sectionKey" value={meta.key} />
              <button type="submit" className="btn btn-ghost" disabled={regenerating}>
                <RefreshCw size={14} aria-hidden="true" />
                {regenerating ? "Переписуємо…" : "Переписати"}
              </button>
            </form>
          </div>

          {section.source !== "AI_DRAFT" ? (
            <p className="field-hint">
              Переписування замінить лише те, чого ви не редагували — ця секція збережеться.
            </p>
          ) : null}

          <Assistant grantId={grantId} sectionKey={meta.key} />
        </>
      )}
    </article>
  );
}

/**
 * Ask for a change to this section.
 *
 * The suggestion is shown, never applied. Accepting goes through the same save
 * path as typing, so a section revised by the assistant ends up marked as the
 * person's — which is true, because they read it and chose it.
 */
function Assistant({ grantId, sectionKey }: { grantId: string; sectionKey: string }) {
  const [state, ask, asking] = useActionState<AssistResult, FormData>(
    assistSectionAction,
    null,
  );
  const [, save, saving] = useActionState<EditorResult, FormData>(saveSectionAction, null);
  const [dismissed, setDismissed] = useState(false);

  const suggestion =
    state && state.ok && state.sectionKey === sectionKey && !dismissed
      ? state.suggestion
      : null;

  return (
    <div className="stack">
      <form action={ask} className="row">
        <input type="hidden" name="grantId" value={grantId} />
        <input type="hidden" name="sectionKey" value={sectionKey} />
        <label className="field assistant-field">
          <span className="field-label">Що змінити в цій секції?</span>
          <input
            className="input"
            name="instruction"
            placeholder="Скоротити вдвічі · додати про роботу з молоддю · простішою мовою"
            maxLength={500}
            required
          />
        </label>
        <button type="submit" className="btn btn-ghost" disabled={asking}>
          <Sparkles size={14} aria-hidden="true" />
          {asking ? "Думаємо…" : "Запропонувати"}
        </button>
      </form>

      {state && !state.ok ? (
        <p className="field-error" role="alert">
          {state.message}
        </p>
      ) : null}

      {suggestion ? (
        <div className="card stack">
          <div className="row">
            <span className="tag tag-state-unknown">Пропозиція AI</span>
            {/* Measured, not claimed. The model's own account of what it did is
                shown next to it and is not always true. */}
            <span className="tag tag-outline">
              {suggestion.lengthDeltaPct === 0
                ? "обсяг той самий"
                : suggestion.lengthDeltaPct < 0
                  ? `коротше на ${Math.abs(suggestion.lengthDeltaPct)}%`
                  : `довше на ${suggestion.lengthDeltaPct}%`}
            </span>
          </div>

          {/* Labelled as the model's account rather than as fact. It routinely
              describes edits it did not make — «прибрав другий абзац» on a
              one-paragraph section — and a reader who takes it literally will
              accept a revision they have not actually read. */}
          <span className="kicker">як описує зміну сама модель</span>
          <p className="card-body">{suggestion.changeNoteUk}</p>
          <p className="field-hint">
            Порівняйте з поточним текстом вище — опис не завжди точний.
          </p>

          {suggestion.unsupportedFigures.length > 0 ? (
            <p className="field-error" role="alert">
              Перевірте числа: {suggestion.unsupportedFigures.join(", ")} — їх немає в ваших
              джерелах.
            </p>
          ) : null}

          <p className="prose concept-text">{suggestion.content}</p>

          <div className="card-meta">
            <form action={save}>
              <input type="hidden" name="grantId" value={grantId} />
              <input type="hidden" name="sectionKey" value={sectionKey} />
              <input type="hidden" name="content" value={suggestion.content} />
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Check size={14} aria-hidden="true" />
                {saving ? "Зберігаємо…" : "Прийняти"}
              </button>
            </form>
            <button type="button" className="btn btn-ghost" onClick={() => setDismissed(true)}>
              Відхилити
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
