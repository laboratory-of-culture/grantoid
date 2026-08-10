/**
 * Answering profile questions by hand.
 *
 * The counterpart to `confirmation.ts`: that promotes what a document proposed,
 * this records what a person typed. Both end in the same place — an
 * `OrganizationFact` with a state that decides what the eligibility agent may
 * conclude from it.
 *
 * Three states are reachable from here, and the difference between them is the
 * whole product:
 *
 *   SELF_REPORTED     the organization stated a value
 *   EXPLICIT_NEGATIVE the organization stated it has none — the only state that
 *                     licenses NOT_ELIGIBLE (DECISIONS.md D4)
 *   UNKNOWN           the answer was withdrawn; back to "we have not asked"
 */

// Value import, not `import type`: `Prisma.DbNull` is a runtime sentinel, and
// clearing a JSON column needs it — `null` there means "JSON null", not "unset".
import { Prisma } from "@prisma/client";

import { FACT_KEYS, factDefinition, type FactValueKind } from "../schemas/fact-registry";
import { recomputeCompleteness } from "./confirmation";
import { prisma, type ScopedClient } from "./tenancy";

export class AnswerRejected extends Error {}

export type AnswerInput = {
  key: string;
  /** Absent or empty means the organization is declaring it has none. */
  value?: string | null;
  /** True when the user chose "we do not have this". */
  negative?: boolean;
};

/** Parse a typed answer, or explain why it is not one. */
function parseValue(
  kind: FactValueKind,
  raw: string,
): { valueText: string; valueJson?: Prisma.InputJsonValue } {
  const text = raw.trim();

  switch (kind) {
    case "NUMBER": {
      // Ukrainian keyboards produce a comma decimal separator, and a space is a
      // thousands separator here. Rejecting "12 500,5" would be rejecting the
      // way the number is actually written.
      const cleaned = text.replace(/\s/g, "").replace(",", ".");
      const n = Number(cleaned);
      if (!Number.isFinite(n)) {
        throw new AnswerRejected("Введіть число.");
      }
      return { valueText: String(n) };
    }

    case "DATE": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        throw new AnswerRejected("Виберіть дату.");
      }
      if (Number.isNaN(Date.parse(text))) {
        throw new AnswerRejected("Такої дати не існує.");
      }
      return { valueText: text };
    }

    case "BOOLEAN": {
      // A "no" arrives as `negative`, not as a value — see `answerFact`.
      if (text !== "так") throw new AnswerRejected("Виберіть «так» або «ні».");
      return { valueText: "так" };
    }

    case "LIST": {
      const items = text
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (items.length === 0) throw new AnswerRejected("Додайте хоча б один пункт.");
      return { valueText: items.join("; "), valueJson: items };
    }

    case "TEXT":
    default:
      if (text.length === 0) throw new AnswerRejected("Заповніть поле.");
      return { valueText: text };
  }
}

/**
 * Record an answer.
 *
 * Anything answered by hand is SELF_REPORTED, never CONFIRMED: confirmation
 * means a human checked a claim against a document, and typing a value is not
 * that. A profile fact still has to be confirmed against an upload before it can
 * be stated to a donor — see `org-knowledge-base`.
 */
export async function answerFact(
  db: ScopedClient,
  organizationId: string,
  input: AnswerInput,
  userId: string | null,
): Promise<void> {
  if (!FACT_KEYS.includes(input.key)) {
    throw new AnswerRejected(`Поле «${input.key}» не існує в реєстрі.`);
  }
  const definition = factDefinition(input.key);
  if (!definition) throw new AnswerRejected("Невідоме поле профілю.");

  const existing = await db.organizationFact.findFirst({
    where: { key: input.key },
    select: { id: true, state: true },
  });

  let state: "SELF_REPORTED" | "EXPLICIT_NEGATIVE";
  let valueText: string;
  let valueJson: Prisma.InputJsonValue | undefined;

  if (input.negative) {
    state = "EXPLICIT_NEGATIVE";
    valueText = definition.kind === "BOOLEAN" ? "ні" : "немає";
  } else {
    const parsed = parseValue(definition.kind, input.value ?? "");
    state = "SELF_REPORTED";
    valueText = parsed.valueText;
    valueJson = parsed.valueJson;
  }

  const data = {
    state,
    valueText,
    valueJson,
    // Typing an answer un-confirms it: the previous confirmation was of a
    // different value, and leaving the timestamp would claim a human checked
    // this one against a document.
    confirmedAt: null,
    confirmedByUserId: null,
    confidence: null,
  };

  await prisma.$transaction(async (tx) => {
    const fact = existing
      ? await tx.organizationFact.update({ where: { id: existing.id }, data })
      : await tx.organizationFact.create({
          data: { organizationId, key: input.key, ...data },
        });

    // Citations belonged to the old value. Keeping them would attach a
    // document's sentence to a number the person just typed over it.
    await tx.citation.deleteMany({ where: { organizationFactId: fact.id } });

    await tx.auditEntry.create({
      data: {
        organizationId,
        actorType: "USER",
        actorId: userId,
        action: "fact.answered",
        subjectType: "OrganizationFact",
        subjectId: fact.id,
        fromState: existing?.state ?? "UNKNOWN",
        toState: state,
      },
    });
  });

  await recomputeCompleteness(organizationId);
}

/**
 * Withdraw an answer, back to UNKNOWN.
 *
 * Not a delete: the row stays, because an absent row and a stored UNKNOWN are
 * different things and only one of them is representable to the agent.
 */
export async function clearFact(
  db: ScopedClient,
  organizationId: string,
  key: string,
  userId: string | null,
): Promise<void> {
  const existing = await db.organizationFact.findFirst({
    where: { key },
    select: { id: true, state: true },
  });
  if (!existing) throw new AnswerRejected("Поле не знайдено.");

  await prisma.$transaction(async (tx) => {
    await tx.citation.deleteMany({ where: { organizationFactId: existing.id } });
    await tx.organizationFact.update({
      where: { id: existing.id },
      data: {
        state: "UNKNOWN",
        valueText: null,
        valueJson: Prisma.DbNull,
        confidence: null,
        confirmedAt: null,
        confirmedByUserId: null,
      },
    });
    await tx.auditEntry.create({
      data: {
        organizationId,
        actorType: "USER",
        actorId: userId,
        action: "fact.withdrawn",
        subjectType: "OrganizationFact",
        subjectId: existing.id,
        fromState: existing.state,
        toState: "UNKNOWN",
      },
    });
  });

  await recomputeCompleteness(organizationId);
}
