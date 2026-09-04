/**
 * The confirmation queue: turning proposals into knowledge.
 *
 * This is the gate `human-in-the-loop` and `org-knowledge-base` both turn on.
 * Extraction proposes; a person decides; only a decided fact may be stated to a
 * donor. Everything here is that decision, recorded.
 */

import type { Prisma } from "@prisma/client";

import { FACT_KEYS, factDefinition, type FactValueKind } from "../schemas/fact-registry";
import { normalizeDateUk } from "../schemas/locale-uk";
import { prisma, type ScopedClient } from "./tenancy";

export class ConfirmationFailed extends Error {}

export type PendingCandidate = {
  id: string;
  key: string;
  labelUk: string;
  /** Drives the correction control — a date gets a date picker, not a text box. */
  kind: FactValueKind;
  state: string;
  valueText: string;
  quote: string;
  page: number | null;
  confidence: number;
  documentId: string;
  documentFilename: string;
  /** What the profile already holds for this key, if anything. */
  currentValue: string | null;
  currentState: string | null;
};

/**
 * Everything awaiting a decision, with the profile's current answer beside it.
 *
 * The current value is the point: accepting a candidate can overwrite an answer
 * the organization gave by hand, and a reviewer who cannot see what they are
 * replacing is not really deciding.
 */
export async function pendingCandidates(db: ScopedClient): Promise<PendingCandidate[]> {
  const [candidates, facts] = await Promise.all([
    db.factCandidate.findMany({
      where: { status: "PENDING" },
      orderBy: [{ key: "asc" }, { confidence: "desc" }],
    }),
    db.organizationFact.findMany(),
  ]);

  const documents = await db.document.findMany({
    where: { id: { in: [...new Set(candidates.map((c) => c.documentId))] } },
    select: { id: true, filename: true },
  });
  const filenameById = new Map(documents.map((d) => [d.id, d.filename]));
  const factByKey = new Map(facts.map((f) => [f.key, f]));

  return candidates.map((c) => {
    const current = factByKey.get(c.key);
    return {
      id: c.id,
      key: c.key,
      labelUk: factDefinition(c.key)?.labelUk ?? c.key,
      kind: factDefinition(c.key)?.kind ?? "TEXT",
      state: c.state,
      valueText: c.valueText,
      quote: c.quote,
      page: c.page,
      confidence: c.confidence,
      documentId: c.documentId,
      documentFilename: filenameById.get(c.documentId) ?? "документ",
      currentValue: current?.state === "UNKNOWN" ? null : (current?.valueText ?? null),
      currentState: current?.state ?? null,
    };
  });
}

/**
 * Accept a proposal, optionally with a corrected value.
 *
 * Writes the fact as CONFIRMED with a citation, because that is what the
 * database requires of a confirmed fact and what makes it usable in an
 * application. The correction is recorded on the candidate rather than
 * discarded — how often people correct an agent is the signal for whether to
 * keep it.
 */
export async function acceptCandidate(
  db: ScopedClient,
  candidateId: string,
  correctedValue: string | null,
  userId: string | null,
): Promise<void> {
  const candidate = await db.factCandidate.findFirst({ where: { id: candidateId } });
  if (!candidate) {
    throw new ConfirmationFailed("Пропозицію не знайдено або вона належить іншій організації.");
  }
  if (candidate.status !== "PENDING") {
    throw new ConfirmationFailed("Цю пропозицію вже розглянуто.");
  }
  if (!FACT_KEYS.includes(candidate.key)) {
    throw new ConfirmationFailed(`Поле «${candidate.key}» більше не існує в реєстрі.`);
  }

  let value = (correctedValue ?? candidate.valueText).trim();
  if (value.length === 0) {
    throw new ConfirmationFailed("Значення не може бути порожнім.");
  }

  // Whether the reviewer changed the value, decided before normalisation folds a
  // date into ISO. Coercing «15 березня 2019 року» to `2019-03-15` is not the
  // reviewer correcting a fact and must not be logged as `fact.corrected`.
  const reviewerEdited = value !== candidate.valueText.trim();

  // A statute writes «зареєстровано 15 березня 2019 року», and the knowledge
  // agent lifts that verbatim. Stored as-is it renders as a blank date picker
  // the next time the field is edited, because the control only reads ISO. The
  // eligibility agent is happier with an unambiguous `2019-03-15` too.
  if (factDefinition(candidate.key)?.kind === "DATE") {
    const iso = normalizeDateUk(value);
    if (iso === null) {
      throw new ConfirmationFailed(
        "Не вдалося розпізнати дату. Виправте значення у форматі РРРР-ММ-ДД перед підтвердженням.",
      );
    }
    value = iso;
  }

  const existing = await db.organizationFact.findFirst({
    where: { key: candidate.key },
    select: { id: true, state: true },
  });
  const now = new Date();

  // Accepting is what promotes a proposal into usable knowledge, so the state
  // has to move. Writing `candidate.state` straight through — which the first
  // version did — leaves a positive fact SELF_REPORTED forever, and
  // `org-knowledge-base` says only CONFIRMED may be stated to a donor. The gate
  // would have looked closed (citation, timestamp, audit entry all present)
  // while nothing it guards ever became reachable.
  //
  // EXPLICIT_NEGATIVE stays as it is: it is already a confirmed statement, and
  // it is the one state that licenses NOT_ELIGIBLE (DECISIONS.md D4).
  const confirmedState = candidate.state === "EXPLICIT_NEGATIVE" ? "EXPLICIT_NEGATIVE" : "CONFIRMED";

  await prisma.$transaction(async (tx) => {
    const factData = {
      state: confirmedState,
      valueText: value,
      confidence: candidate.confidence,
      confirmedAt: now,
      confirmedByUserId: userId,
    } satisfies Prisma.OrganizationFactUncheckedUpdateInput;

    const fact = existing
      ? await tx.organizationFact.update({ where: { id: existing.id }, data: factData })
      : await tx.organizationFact.create({
          data: {
            organizationId: candidate.organizationId,
            key: candidate.key,
            ...factData,
          },
        });

    // A CONFIRMED fact without a citation is rejected by the database, and
    // rightly: it would be a claim nobody can trace back to a document.
    await tx.citation.create({
      data: {
        quote: candidate.quote,
        page: candidate.page,
        documentId: candidate.documentId,
        organizationFactId: fact.id,
        retrievedAt: now,
      },
    });

    await tx.factCandidate.update({
      where: { id: candidate.id },
      data: {
        status: "ACCEPTED",
        resolvedAt: now,
        resolvedBy: userId,
        acceptedValue: value === candidate.valueText ? null : value,
        // ^ still records the stored form when it differs, normalisation included
      },
    });

    await tx.auditEntry.create({
      data: {
        organizationId: candidate.organizationId,
        actorType: "USER",
        actorId: userId,
        action: reviewerEdited ? "fact.corrected" : "fact.confirmed",
        subjectType: "OrganizationFact",
        subjectId: fact.id,
        fromState: existing?.state ?? "UNKNOWN",
        toState: confirmedState,
      },
    });
  });

  await recomputeCompleteness(candidate.organizationId);
}

export async function rejectCandidate(
  db: ScopedClient,
  candidateId: string,
  userId: string | null,
): Promise<void> {
  const candidate = await db.factCandidate.findFirst({ where: { id: candidateId } });
  if (!candidate) {
    throw new ConfirmationFailed("Пропозицію не знайдено або вона належить іншій організації.");
  }
  if (candidate.status !== "PENDING") {
    throw new ConfirmationFailed("Цю пропозицію вже розглянуто.");
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.factCandidate.update({
      where: { id: candidate.id },
      data: { status: "REJECTED", resolvedAt: now, resolvedBy: userId },
    }),
    prisma.auditEntry.create({
      data: {
        organizationId: candidate.organizationId,
        actorType: "USER",
        actorId: userId,
        action: "fact.proposal_rejected",
        subjectType: "FactCandidate",
        subjectId: candidate.id,
        fromState: "PENDING",
        toState: "REJECTED",
      },
    }),
  ]);
}

/** Share of registry keys that have been answered. Drives onboarding progress. */
export async function recomputeCompleteness(organizationId: string): Promise<number> {
  const answered = await prisma.organizationFact.count({
    where: { organizationId, state: { not: "UNKNOWN" } },
  });
  const completeness = answered / FACT_KEYS.length;
  await prisma.organization.update({
    where: { id: organizationId },
    data: { profileCompleteness: completeness },
  });
  return completeness;
}
