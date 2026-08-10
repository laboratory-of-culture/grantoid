"use server";

import { revalidatePath } from "next/cache";

import {
  UploadRejected,
  deleteDocument,
  uploadDocument,
} from "../../packages/db/documents";
import { currentDb } from "../lib/session";

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
