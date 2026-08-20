"use server";

import { redirect } from "next/navigation";

import {
  PrivateGrantFailed,
  createGrantFromDocument,
} from "../../../packages/db/private-grants";
import { requireDb } from "../../lib/session";

export type UploadCallResult = { ok: false; message: string } | null;

/**
 * Start from a call the organization received directly.
 *
 * Redirects into the editor on success rather than reporting it: the person
 * uploaded a PDF because they intend to write against it, and an interstitial
 * saying "created" is a click between them and the work.
 */
export async function createCallFromFileAction(
  _prev: UploadCallResult,
  form: FormData,
): Promise<UploadCallResult> {
  const { organizationId } = await requireDb();
  const file = form.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Виберіть файл, щоб завантажити." };
  }

  let grantId: string;
  try {
    const created = await createGrantFromDocument(organizationId, {
      filename: file.name,
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    grantId = created.grantId;
  } catch (err) {
    if (err instanceof PrivateGrantFailed) return { ok: false, message: err.message };
    console.error("private grant creation failed", err);
    return {
      ok: false,
      message: "Не вдалося опрацювати документ. Перевірте, чи запущено локальну модель.",
    };
  }

  redirect(`/hranty/${grantId}/redaktor`);
}
