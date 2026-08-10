"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "../../../packages/db/tenancy";
import { monitorSource, reviewRobots } from "../../../packages/ingestion/monitor";
import { requireAdmin } from "../../lib/session";

export type AdminResult = { ok: true; message: string } | { ok: false; message: string } | null;

export async function checkSourceAction(
  _prev: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const user = await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!id) return { ok: false, message: "Не вказано джерело." };

  const result = await monitorSource(id);

  await prisma.auditEntry.create({
    data: {
      // The registry is not an organization's data, but the action still has an
      // actor and still belongs in the log.
      organizationId: "platform",
      actorType: "USER",
      actorId: user.userId,
      action: result.error ? "source.check_failed" : "source.checked",
      subjectType: "Source",
      subjectId: id,
    },
  });

  revalidatePath("/dzherela");

  if (result.error) return { ok: false, message: result.error };
  return {
    ok: true,
    message:
      `Знайдено ${result.found}: нових ${result.added}, змінених ${result.changed}, ` +
      `без змін ${result.unchanged}.`,
  };
}

export async function reviewRobotsAction(
  _prev: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!id) return { ok: false, message: "Не вказано джерело." };

  const result = await reviewRobots(id);
  revalidatePath("/dzherela");
  return { ok: result.allowed, message: result.note };
}

export async function toggleSourceAction(
  _prev: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const user = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const source = await prisma.source.findUnique({ where: { id } });
  if (!source) return { ok: false, message: "Джерело не знайдено." };

  const next = !source.enabled;

  // The database refuses an enabled source that is unconfigured or unreviewed.
  // Catching it here turns a constraint violation into a sentence explaining
  // which step is missing.
  if (next) {
    if (!source.discoveryUrl || !source.userAgent) {
      return { ok: false, message: "Спершу вкажіть адресу перегляду та User-Agent." };
    }
    if (!source.robotsCheckedAt || !source.tosReviewedAt) {
      return {
        ok: false,
        message: "Спершу перевірте robots.txt і зафіксуйте перегляд умов використання.",
      };
    }
  }

  await prisma.source.update({ where: { id }, data: { enabled: next } });
  await prisma.auditEntry.create({
    data: {
      organizationId: "platform",
      actorType: "USER",
      actorId: user.userId,
      action: next ? "source.enabled" : "source.disabled",
      subjectType: "Source",
      subjectId: id,
      fromState: source.enabled ? "enabled" : "disabled",
      toState: next ? "enabled" : "disabled",
    },
  });

  revalidatePath("/dzherela");
  return { ok: true, message: next ? "Джерело увімкнено." : "Джерело вимкнено." };
}
