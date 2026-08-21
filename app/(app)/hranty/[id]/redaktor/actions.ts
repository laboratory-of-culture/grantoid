"use server";

import { revalidatePath } from "next/cache";

import {
  ConceptGenerationFailed,
  approveConcept,
  approveSection,
  editSection,
  generateDraft,
  applyFinding,
  reviewConceptSection,
  reviewWholeConcept,
  suggestSectionRevision,
  type ConceptReview,
  type SectionReview,
  type SuggestionView,
} from "../../../../../packages/db/concepts";
import {
  UploadRejected,
  deleteDocument,
  uploadDocument,
} from "../../../../../packages/db/documents";
import { requireDb } from "../../../../lib/session";

export type EditorResult = { ok: false; message: string } | { ok: true } | null;

export type AssistResult =
  | { ok: false; message: string }
  | { ok: true; sectionKey: string; suggestion: SuggestionView }
  | null;

/**
 * Ask for a revision. Saves nothing.
 *
 * The suggestion comes back to the screen and stays there until a person
 * accepts it, which routes through `saveSectionAction` and marks the section as
 * theirs. Writing straight to the draft would leave text a model produced,
 * sitting in a section labelled as read by a human.
 */
export async function assistSectionAction(
  _prev: AssistResult,
  form: FormData,
): Promise<AssistResult> {
  const { organizationId } = await requireDb();
  const grantId = String(form.get("grantId") ?? "");
  const sectionKey = String(form.get("sectionKey") ?? "");
  const instruction = String(form.get("instruction") ?? "");

  try {
    const suggestion = await suggestSectionRevision(
      organizationId,
      grantId,
      sectionKey,
      instruction,
    );
    return { ok: true, sectionKey, suggestion };
  } catch (err) {
    if (err instanceof ConceptGenerationFailed) return { ok: false, message: err.message };
    console.error("assistant failed", err);
    return {
      ok: false,
      message: "Не вдалося отримати пропозицію. Перевірте, чи запущено локальну модель.",
    };
  }
}

/**
 * Every action re-resolves the organization from the session rather than
 * trusting a form field. A grant id in a hidden input is user-supplied; the
 * organization it is written against must not be.
 */
export async function generateAction(_prev: EditorResult, form: FormData): Promise<EditorResult> {
  const { organizationId } = await requireDb();
  const grantId = String(form.get("grantId") ?? "");
  const only = String(form.get("sectionKey") ?? "");

  try {
    await generateDraft(organizationId, grantId, only ? { onlyKeys: [only] } : {});
  } catch (err) {
    if (err instanceof ConceptGenerationFailed) return { ok: false, message: err.message };
    console.error("concept generation failed", err);
    return {
      ok: false,
      message: "Не вдалося згенерувати чернетку. Перевірте, чи запущено локальну модель.",
    };
  }

  revalidatePath(`/hranty/${grantId}/redaktor`);
  return { ok: true };
}

export async function saveSectionAction(
  _prev: EditorResult,
  form: FormData,
): Promise<EditorResult> {
  const { organizationId, user } = await requireDb();
  const grantId = String(form.get("grantId") ?? "");
  const key = String(form.get("sectionKey") ?? "");
  const content = String(form.get("content") ?? "");

  if (content.trim().length === 0) {
    return { ok: false, message: "Порожню секцію не збережено. Видаліть її або напишіть текст." };
  }

  try {
    await editSection(organizationId, grantId, key, content, user.userId);
  } catch (err) {
    if (err instanceof ConceptGenerationFailed) return { ok: false, message: err.message };
    throw err;
  }

  revalidatePath(`/hranty/${grantId}/redaktor`);
  return { ok: true };
}

/**
 * Upload the donor's own material for this call.
 *
 * Always `CALL_GUIDELINES` and always carrying the grant id: that pair is what
 * keeps it out of the profile knowledge base. A donor's co-financing rule filed
 * as a fact about the organization would be a corruption nothing downstream
 * could detect.
 */
export async function uploadDonorDocAction(
  _prev: EditorResult,
  form: FormData,
): Promise<EditorResult> {
  const { db, organizationId } = await requireDb();
  const grantId = String(form.get("grantId") ?? "");
  const file = form.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Виберіть файл, щоб завантажити." };
  }

  try {
    await uploadDocument(db, {
      organizationId,
      grantId,
      filename: file.name,
      mimeType: file.type,
      kind: "CALL_GUIDELINES",
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
  } catch (err) {
    if (err instanceof UploadRejected) return { ok: false, message: err.message };
    console.error("donor upload failed", err);
    return { ok: false, message: "Не вдалося зберегти файл. Спробуйте ще раз за хвилину." };
  }

  revalidatePath(`/hranty/${grantId}/redaktor`);
  return { ok: true };
}

export async function deleteDonorDocAction(
  _prev: EditorResult,
  form: FormData,
): Promise<EditorResult> {
  const { db } = await requireDb();
  const grantId = String(form.get("grantId") ?? "");
  const documentId = String(form.get("documentId") ?? "");

  try {
    await deleteDocument(db, documentId);
  } catch (err) {
    console.error("donor delete failed", err);
    return { ok: false, message: "Не вдалося видалити документ." };
  }

  revalidatePath(`/hranty/${grantId}/redaktor`);
  return { ok: true };
}


export type ReviewResult =
  | { ok: false; message: string }
  | { ok: true; review: SectionReview }
  | null;

/**
 * Check one section and return what is wrong with it.
 *
 * Saves nothing. The findings are pointers, and every one of them is a decision
 * for the person who wrote the text — which is the difference between this and
 * the assistant, and the reason it can run without asking permission first.
 */
export async function reviewSectionAction(
  _prev: ReviewResult,
  form: FormData,
): Promise<ReviewResult> {
  const { organizationId } = await requireDb();
  const grantId = String(form.get("grantId") ?? "");
  const sectionKey = String(form.get("sectionKey") ?? "");

  try {
    const review = await reviewConceptSection(organizationId, grantId, sectionKey);
    return { ok: true, review };
  } catch (err) {
    if (err instanceof ConceptGenerationFailed) return { ok: false, message: err.message };
    console.error("review failed", err);
    return {
      ok: false,
      message: "Не вдалося перевірити секцію. Перевірте, чи запущено локальну модель.",
    };
  }
}


export type DocumentReviewResult =
  | { ok: false; message: string }
  | { ok: true; review: ConceptReview }
  | null;

/**
 * Check the whole document at once.
 *
 * One button rather than eight, because a writer reads a concept note as one
 * argument and wants to know what is wrong with it, not with paragraph four.
 * It takes roughly six seconds a section on a local model, and the screen says
 * so — a wait that is explained is a wait people sit through.
 */
export async function reviewDocumentAction(
  _prev: DocumentReviewResult,
  form: FormData,
): Promise<DocumentReviewResult> {
  const { organizationId } = await requireDb();
  const grantId = String(form.get("grantId") ?? "");

  try {
    return { ok: true, review: await reviewWholeConcept(organizationId, grantId) };
  } catch (err) {
    if (err instanceof ConceptGenerationFailed) return { ok: false, message: err.message };
    console.error("document review failed", err);
    return {
      ok: false,
      message: "Не вдалося перевірити текст. Перевірте, чи запущено локальну модель.",
    };
  }
}

/** Replace one flagged span with what the finding suggested. */
export async function applyFindingAction(
  _prev: EditorResult,
  form: FormData,
): Promise<EditorResult> {
  const { organizationId, user } = await requireDb();
  const grantId = String(form.get("grantId") ?? "");
  const sectionKey = String(form.get("sectionKey") ?? "");
  const quote = String(form.get("quote") ?? "");
  const replacement = String(form.get("replacement") ?? "");

  try {
    await applyFinding(organizationId, grantId, sectionKey, quote, replacement, user.userId);
  } catch (err) {
    if (err instanceof ConceptGenerationFailed) return { ok: false, message: err.message };
    throw err;
  }

  revalidatePath(`/hranty/${grantId}/redaktor`);
  return { ok: true };
}

export async function approveSectionAction(
  _prev: EditorResult,
  form: FormData,
): Promise<EditorResult> {
  const { organizationId, user } = await requireDb();
  const grantId = String(form.get("grantId") ?? "");
  const key = String(form.get("sectionKey") ?? "");

  try {
    await approveSection(organizationId, grantId, key, user.userId);
  } catch (err) {
    if (err instanceof ConceptGenerationFailed) return { ok: false, message: err.message };
    throw err;
  }

  revalidatePath(`/hranty/${grantId}/redaktor`);
  return { ok: true };
}

/**
 * Confirm the whole note.
 *
 * Replaces eight per-section confirmations with one. What it asserts is
 * unchanged and deliberately unsoftened: a person has read every section and
 * takes responsibility for it.
 */
export async function approveConceptAction(
  _prev: EditorResult,
  form: FormData,
): Promise<EditorResult> {
  const { organizationId, user } = await requireDb();
  const grantId = String(form.get("grantId") ?? "");

  try {
    await approveConcept(organizationId, grantId, user.userId);
  } catch (err) {
    if (err instanceof ConceptGenerationFailed) return { ok: false, message: err.message };
    throw err;
  }

  revalidatePath(`/hranty/${grantId}/redaktor`);
  return { ok: true };
}
