"use server";

import { revalidatePath } from "next/cache";

import {
  ConceptGenerationFailed,
  approveSection,
  editSection,
  generateDraft,
} from "../../../../../packages/db/concepts";
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
