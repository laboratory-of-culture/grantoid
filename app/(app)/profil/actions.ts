"use server";

import { revalidatePath } from "next/cache";

import {
  UploadRejected,
  deleteDocument,
  uploadDocument,
} from "../../../packages/db/documents";
import {
  ConfirmationFailed,
  acceptCandidate,
  rejectCandidate,
} from "../../../packages/db/confirmation";
import { ExtractionFailed, extractDocumentFacts } from "../../../packages/db/extraction";
import { AnswerRejected, answerFact, clearFact } from "../../../packages/db/facts";
import { ensureUnsubscribeToken } from "../../../packages/notifications/send";
import { prisma } from "../../../packages/db/tenancy";
import { currentDb } from "../../lib/session";

export type ActionResult = { ok: true } | { ok: false; message: string };

const KINDS = new Set([
  "STATUT",
  "REGISTRATION",
  "ANNUAL_REPORT",
  "PREVIOUS_APPLICATION",
  "PROJECT_DESCRIPTION",
  "STRATEGY",
  "OTHER",
]);

export async function uploadDocumentAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const ctx = await currentDb();
  if (!ctx) return { ok: false, message: "Немає активної організації." };

  const file = form.get("file");
  const kind = String(form.get("kind") ?? "OTHER");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Виберіть файл, щоб завантажити." };
  }
  if (!KINDS.has(kind)) {
    return { ok: false, message: "Виберіть тип документа зі списку." };
  }

  try {
    await uploadDocument(ctx.db, {
      organizationId: ctx.organizationId,
      filename: file.name,
      mimeType: file.type,
      kind: kind as never,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
  } catch (err) {
    // Rejections carry copy written for the person uploading. Anything else is
    // ours, and the detail belongs in the log rather than on their screen.
    if (err instanceof UploadRejected) return { ok: false, message: err.message };
    console.error("upload failed", err);
    return {
      ok: false,
      message: "Не вдалося зберегти файл. Спробуйте ще раз за хвилину.",
    };
  }

  revalidatePath("/profil");
  return { ok: true };
}

export async function answerFactAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const ctx = await currentDb();
  if (!ctx) return { ok: false, message: "Немає активної організації." };

  const key = String(form.get("key") ?? "");
  const negative = form.get("negative") === "1";
  const value = form.get("value");

  try {
    await answerFact(
      ctx.db,
      ctx.organizationId,
      { key, negative, value: typeof value === "string" ? value : null },
      ctx.user.userId,
    );
  } catch (err) {
    if (err instanceof AnswerRejected) return { ok: false, message: err.message };
    console.error("answer failed", err);
    return { ok: false, message: "Не вдалося зберегти відповідь. Спробуйте ще раз." };
  }

  revalidatePath("/profil");
  return { ok: true };
}

export async function clearFactAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const ctx = await currentDb();
  if (!ctx) return { ok: false, message: "Немає активної організації." };

  try {
    await clearFact(ctx.db, ctx.organizationId, String(form.get("key") ?? ""), ctx.user.userId);
  } catch (err) {
    if (err instanceof AnswerRejected) return { ok: false, message: err.message };
    console.error("clear failed", err);
    return { ok: false, message: "Не вдалося очистити поле. Спробуйте ще раз." };
  }

  revalidatePath("/profil");
  return { ok: true };
}

export async function acceptCandidateAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const ctx = await currentDb();
  if (!ctx) return { ok: false, message: "Немає активної організації." };

  const id = String(form.get("id") ?? "");
  if (!id) return { ok: false, message: "Не вказано пропозицію." };

  // Present only when the reviewer edited the value before confirming.
  const raw = form.get("value");
  const corrected = typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;

  try {
    await acceptCandidate(ctx.db, id, corrected, ctx.user.userId);
  } catch (err) {
    if (err instanceof ConfirmationFailed) return { ok: false, message: err.message };
    console.error("accept failed", err);
    return { ok: false, message: "Не вдалося зберегти. Спробуйте ще раз." };
  }

  revalidatePath("/profil");
  return { ok: true };
}

export async function rejectCandidateAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const ctx = await currentDb();
  if (!ctx) return { ok: false, message: "Немає активної організації." };

  const id = String(form.get("id") ?? "");
  if (!id) return { ok: false, message: "Не вказано пропозицію." };

  try {
    await rejectCandidate(ctx.db, id, ctx.user.userId);
  } catch (err) {
    if (err instanceof ConfirmationFailed) return { ok: false, message: err.message };
    console.error("reject failed", err);
    return { ok: false, message: "Не вдалося зберегти. Спробуйте ще раз." };
  }

  revalidatePath("/profil");
  return { ok: true };
}

export async function extractDocumentAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const ctx = await currentDb();
  if (!ctx) return { ok: false, message: "Немає активної організації." };

  const id = String(form.get("id") ?? "");
  if (!id) return { ok: false, message: "Не вказано документ." };

  try {
    await extractDocumentFacts(ctx.db, id);
  } catch (err) {
    if (err instanceof ExtractionFailed) return { ok: false, message: err.message };
    console.error("extraction failed", err);
    return {
      ok: false,
      message: "Не вдалося опрацювати документ. Спробуйте ще раз за хвилину.",
    };
  }

  revalidatePath("/profil");
  return { ok: true };
}

export async function deleteDocumentAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const ctx = await currentDb();
  if (!ctx) return { ok: false, message: "Немає активної організації." };

  const id = String(form.get("id") ?? "");
  if (!id) return { ok: false, message: "Не вказано документ." };

  try {
    // Removes the row and the bytes together — see packages/db/documents.ts.
    await deleteDocument(ctx.db, id);
  } catch (err) {
    console.error("delete failed", err);
    return { ok: false, message: "Не вдалося видалити документ. Спробуйте ще раз." };
  }

  revalidatePath("/profil");
  return { ok: true };
}

/**
 * Turn the weekly digest on or off.
 *
 * Per person, not per organization: two people in the same NGO can want
 * different things from their inbox, and subscribing a colleague is not a
 * decision anyone gets to make for them.
 */
export async function setDigestAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const ctx = await currentDb();
  if (!ctx) return { ok: false, message: "Немає активної організації." };

  const on = form.get("digestOptIn") === "on";

  try {
    if (on) await ensureUnsubscribeToken(ctx.user.userId);
    await prisma.user.update({
      where: { id: ctx.user.userId },
      data: { digestOptIn: on },
    });
  } catch (err) {
    console.error("digest preference failed", err);
    return { ok: false, message: "Не вдалося зберегти налаштування. Спробуйте ще раз." };
  }

  revalidatePath("/profil");
  return { ok: true };
}
