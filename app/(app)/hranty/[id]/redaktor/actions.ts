"use server";

import { revalidatePath } from "next/cache";

import {
  ConceptGenerationFailed,
  approveSection,
  editSection,
  generateDraft,
} from "../../../../../packages/db/concepts";
import {
  UploadRejected,
  deleteDocument,
  uploadDocument,
} from "../../../../../packages/db/documents";
import { requireDb } from "../../../../lib/session";

export type EditorResult = { ok: false; message: string } | { ok: true } | null;

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
