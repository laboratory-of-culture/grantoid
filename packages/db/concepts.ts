/**
 * Storing and revising a concept note.
 *
 * The invariant this module exists to keep: **a section a model wrote and
 * nobody has read is distinguishable from every other section, at all times.**
 * `human-in-the-loop` turns on it, and it is the kind of thing that erodes
 * silently — one convenient `updateMany`, and a draft that was never read looks
 * exactly like one that was.
 *
 * So generation only ever writes `AI_DRAFT`, editing is the only path to
 * `HUMAN_EDITED`, and approval is an explicit act with its own timestamp.
 */

import { generateConcept } from "../../agents/concept";
import { forOrganization, prisma } from "./tenancy";
import {
  CONCEPT_SECTIONS,
  sectionDefinition,
  unreviewedSections,
  unsupportedNumbers,
} from "../schemas/concept";
import { renderProfileText } from "../schemas/profile-text";
import { toGrant, toProfile } from "../matching/adapters";

export type ConceptView = {
  id: string;
  grantId: string;
  title: string;
  status: "DRAFT" | "REVIEWED";
  sections: {
    key: string;
    labelUk: string;
    promptUk: string;
    orderIndex: number;
    content: string;
    source: "AI_DRAFT" | "HUMAN_EDITED" | "HUMAN";
    editedAt: Date | null;
    approvedAt: Date | null;
    /**
     * Figures in this section that neither the profile nor the call supports.
     *
     * Computed on read rather than stored, so it stays true after an edit, and
     * only for sections the model wrote and nobody has checked — a person
     * typing a number into their own application knows where it came from.
     */
    unsupportedFigures: string[];
  }[];
  /** Section keys still carrying an unread AI draft. */
  unreviewed: string[];
  updatedAt: Date;
};

export async function loadConcept(
  organizationId: string,
  grantId: string,
): Promise<ConceptView | null> {
  const db = forOrganization(organizationId);
  const draft = await db.conceptDraft.findFirst({
    where: { grantId },
    include: { sections: { orderBy: { orderIndex: "asc" } } },
  });
  if (!draft) return null;

  // The same two texts the generator was given, so "is this figure supported"
  // is asked against exactly what it had to work from.
  const [orgRow, grantRow] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: { facts: { include: { citations: true } } },
    }),
    prisma.grant.findUniqueOrThrow({
      where: { id: grantId },
      include: { rules: { include: { citations: true } } },
    }),
  ]);

  const sources = [
    renderProfileText(toProfile(orgRow)),
    JSON.stringify(toGrant(grantRow)),
  ];

  return {
    id: draft.id,
    grantId: draft.grantId,
    title: draft.title,
    status: draft.status,
    sections: draft.sections.map((s) => ({
      key: s.key,
      labelUk: sectionDefinition(s.key)?.labelUk ?? s.key,
      promptUk: sectionDefinition(s.key)?.promptUk ?? "",
      orderIndex: s.orderIndex,
      content: s.content,
      source: s.source,
      editedAt: s.editedAt,
      approvedAt: s.approvedAt,
      unsupportedFigures:
        s.source === "AI_DRAFT" ? unsupportedNumbers(s.content, sources) : [],
    })),
    unreviewed: unreviewedSections(draft.sections),
    updatedAt: draft.updatedAt,
  };
}

export class ConceptGenerationFailed extends Error {}

/**
 * Generate, or regenerate the sections nobody has touched.
 *
 * Regeneration never overwrites a section a person has edited or approved.
 * Losing someone's writing to a button they pressed expecting a different
 * section to change is the kind of harm no undo makes up for, and the source
 * column already records exactly which sections are safe to replace.
 */
export async function generateDraft(
  organizationId: string,
  grantId: string,
  opts: { onlyKeys?: string[] } = {},
): Promise<ConceptView> {
  const db = forOrganization(organizationId);

  const orgRow = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    include: { facts: { include: { citations: true } } },
  });
  const grantRow = await prisma.grant.findUniqueOrThrow({
    where: { id: grantId },
    include: { rules: { include: { citations: true } } },
  });

  const existing = await db.conceptDraft.findFirst({
    where: { grantId },
    include: { sections: true },
  });

  const protectedKeys = new Set(
    (existing?.sections ?? [])
      .filter((s) => s.source !== "AI_DRAFT" || s.approvedAt !== null)
      .map((s) => s.key),
  );

  const wanted = (opts.onlyKeys ?? CONCEPT_SECTIONS.map((s) => s.key)).filter(
    (k) => !protectedKeys.has(k),
  );

  if (wanted.length === 0) {
    const view = await loadConcept(organizationId, grantId);
    if (!view) throw new ConceptGenerationFailed("немає що генерувати");
    return view;
  }

  const run = await generateConcept(toProfile(orgRow), toGrant(grantRow), wanted);
  if (!run.result) {
    throw new ConceptGenerationFailed(
      run.error ?? "модель не повернула чернетку. Спробуйте ще раз.",
    );
  }

  const orderOf = new Map(CONCEPT_SECTIONS.map((s, i) => [s.key, i]));
  const now = new Date();

  const draft =
    existing ??
    (await db.conceptDraft.create({
      data: {
        organizationId,
        grantId,
        title: run.result.titleUk,
        modelTag: run.usage.model,
        promptFingerprint: run.promptFingerprint,
      },
    }));

  for (const section of run.result.sections) {
    await prisma.conceptSection.upsert({
      where: { draftId_key: { draftId: draft.id, key: section.key } },
      create: {
        draftId: draft.id,
        key: section.key,
        orderIndex: orderOf.get(section.key) ?? 0,
        content: section.content.trim(),
        source: "AI_DRAFT",
      },
      // Only reachable for keys not in `protectedKeys`, so this cannot
      // overwrite anyone's writing.
      update: {
        content: section.content.trim(),
        source: "AI_DRAFT",
        editedAt: null,
        editedByUserId: null,
        approvedAt: null,
      },
    });
  }

  await prisma.auditEntry.create({
    data: {
      organizationId,
      actorType: "AGENT",
      actorId: `concept@${run.promptFingerprint}`,
      action: "concept.generated",
      subjectType: "ConceptDraft",
      subjectId: draft.id,
      toState: "AI_DRAFT",
      modelTag: run.usage.model,
      promptFingerprint: run.promptFingerprint,
    },
  });

  await prisma.conceptDraft.update({
    where: { id: draft.id },
    data: {
      modelTag: run.usage.model,
      promptFingerprint: run.promptFingerprint,
      updatedAt: now,
      // Any regeneration reopens review: the document as a whole is no longer
      // the one a person signed off on.
      status: "DRAFT",
    },
  });

  const view = await loadConcept(organizationId, grantId);
  if (!view) throw new ConceptGenerationFailed("чернетку не збережено");
  return view;
}

/** A person rewrote a section. That is what takes it out of AI_DRAFT. */
export async function editSection(
  organizationId: string,
  grantId: string,
  key: string,
  content: string,
  userId: string,
): Promise<void> {
  const db = forOrganization(organizationId);
  const draft = await db.conceptDraft.findFirst({ where: { grantId }, select: { id: true } });
  if (!draft) throw new ConceptGenerationFailed("чернетки ще немає");

  const now = new Date();
  const existing = await prisma.conceptSection.findUnique({
    where: { draftId_key: { draftId: draft.id, key } },
  });

  await prisma.conceptSection.upsert({
    where: { draftId_key: { draftId: draft.id, key } },
    create: {
      draftId: draft.id,
      key,
      orderIndex: CONCEPT_SECTIONS.findIndex((s) => s.key === key),
      content: content.trim(),
      // Typed from scratch rather than edited from a draft — a different thing,
      // and worth keeping apart when someone later asks what the model wrote.
      source: "HUMAN",
      editedAt: now,
      editedByUserId: userId,
    },
    update: {
      content: content.trim(),
      source: existing?.source === "HUMAN" ? "HUMAN" : "HUMAN_EDITED",
      editedAt: now,
      editedByUserId: userId,
    },
  });

  await prisma.conceptDraft.update({
    where: { id: draft.id },
    data: { status: "DRAFT", updatedAt: now },
  });
}

/**
 * A person read a section and says it is right.
 *
 * Separate from editing, because "I read it and it is correct" and "I changed
 * it" are different statements, and a draft where every section happened to
 * need no changes is still a draft somebody read.
 */
export async function approveSection(
  organizationId: string,
  grantId: string,
  key: string,
  userId: string,
): Promise<void> {
  const db = forOrganization(organizationId);
  const draft = await db.conceptDraft.findFirst({
    where: { grantId },
    include: { sections: true },
  });
  if (!draft) throw new ConceptGenerationFailed("чернетки ще немає");

  const now = new Date();
  await prisma.conceptSection.update({
    where: { draftId_key: { draftId: draft.id, key } },
    data: { approvedAt: now },
  });

  await prisma.auditEntry.create({
    data: {
      organizationId,
      actorType: "USER",
      actorId: userId,
      action: "concept.section_approved",
      subjectType: "ConceptSection",
      subjectId: `${draft.id}:${key}`,
      toState: "APPROVED",
    },
  });

  const after = await prisma.conceptSection.findMany({ where: { draftId: draft.id } });
  const stillUnread = unreviewedSections(after);

  await prisma.conceptDraft.update({
    where: { id: draft.id },
    data: {
      updatedAt: now,
      status:
        stillUnread.length === 0 && after.length === CONCEPT_SECTIONS.length
          ? "REVIEWED"
          : "DRAFT",
    },
  });
}
