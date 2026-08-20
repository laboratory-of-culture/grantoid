"use server";

import { unsubscribeByToken } from "../../../packages/notifications/send";

export type UnsubscribeResult = { done: boolean } | null;

/**
 * Stop the digest, on a POST.
 *
 * Deliberately not done while rendering the page. Corporate mail security —
 * Outlook Safe Links, Proofpoint URL Defense — fetches every URL in a message
 * before the recipient sees it, and a GET that mutates means the scanner
 * unsubscribes people who never opened the mail. The failure is silent on both
 * ends: they stop receiving the digest and nobody can say why.
 */
export async function unsubscribeAction(
  _prev: UnsubscribeResult,
  form: FormData,
): Promise<UnsubscribeResult> {
  const token = String(form.get("t") ?? "");
  return { done: await unsubscribeByToken(token) };
}
