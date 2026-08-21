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

import { createHash } from "node:crypto";

import { generateConcept } from "../../agents/concept";
import { MAX_INSTRUCTION_CHARS, suggestRevision } from "../../agents/assistant";
import { reviewSection } from "../../agents/reviewer";
import { donorMaterial } from "./donor-docs";
import { forOrganization, prisma } from "./tenancy";
import {
  CONCEPT_SECTIONS,
  sectionDefinition,
  unreviewedSections,
  unsupportedNumbers,
} from "../schemas/concept";
import { CONCEPT_PREREQUISITES, factDefinition } from "../schemas/fact-registry";
import { renderProfileText } from "../schemas/profile-text";
import { ruleFindings, verifiedFindings, type Finding } from "../schemas/writing-checks";
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
  /**
   * Donor documents that produced readable text — what the generator actually
   * had, not what was uploaded.
   *
   * A scan with no text layer is a file in the list and nothing in the prompt.
   * Reported from here because this is where the material is already read, and
   * because a provenance line counting the uploads would credit the draft to a
   * source the model never saw.
   */
  donorDocsRead: number;
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

  // Donor documents count as a source: a figure the guidelines state is
  // supported, and flagging it would train people to click past the warning.
  const donor = await donorMaterial(organizationId, grantId);
  const sources = [
    renderProfileText(toProfile(orgRow)),
    JSON.stringify(toGrant(grantRow)),
    donor.text,
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
    donorDocsRead: donor.readable.length,
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

  // Nothing to compose from is not a thin draft — it is fiction with the
  // organization's name on it. See CONCEPT_PREREQUISITES for the draft that
  // proved it: an empty profile produced an agricultural NGO with a twenty
  // per cent target and prior experience, none of which existed.
  const answered = new Set(
    orgRow.facts.filter((f) => f.state !== "UNKNOWN").map((f) => f.key),
  );
  const missing = CONCEPT_PREREQUISITES.filter((key) => !answered.has(key));
  if (missing.length === CONCEPT_PREREQUISITES.length) {
    const labels = missing.map((k) => factDefinition(k)?.labelUk ?? k);
    throw new ConceptGenerationFailed(
      "Профіль порожній, тож писати нема з чого — модель вигадала б і напрями " +
        "діяльності, і досвід. Заповніть у профілі: " +
        `${labels.join(", ")} — і поверніться сюди.`,
    );
  }

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

  // The donor's own documents, when the organization has uploaded any. Without
  // them the generator writes against a notice about the call; with them it
  // writes against the call.
  const donor = await donorMaterial(organizationId, grantId);

  const profile = toProfile(orgRow);
  const call = toGrant(grantRow);

  const run = await generateConcept(profile, call, wanted, donor.text);
  if (!run.result) {
    throw new ConceptGenerationFailed(
      run.error ?? "модель не повернула чернетку. Спробуйте ще раз.",
    );
  }

  // A second pass over whatever did not come back, asked for on its own.
  //
  // Length is what breaks this. Eight section briefs on top of twelve thousand
  // characters of donor guidelines is where the model stopped writing and began
  // copying its own instructions back — the failure `echoesInstructions` now
  // rejects, which turns a bad draft into a missing one. Asking again for only
  // the missing keys shortens the prompt by exactly the part that caused it,
  // and the sections that did come back are not regenerated.
  //
  // One retry, not a loop: if a shorter prompt does not fix it, a shorter one
  // still will not, and an organization waiting on a spinner should be told.
  const written = [...run.result.sections];
  if (run.missingSections.length > 0) {
    const second = await generateConcept(profile, call, run.missingSections, donor.text);
    if (second.result) written.push(...second.result.sections);
  }

  if (written.length === 0) {
    throw new ConceptGenerationFailed(
      "модель не написала жодної секції — повернула замість тексту власну інструкцію. " +
        "Спробуйте ще раз; якщо повториться, приберіть частину документів донора.",
    );
  }
  run.result.sections = written;

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

export type SuggestionView = {
  content: string;
  changeNoteUk: string;
  /** Figures in the suggestion that no source supports. Same guard as a draft. */
  unsupportedFigures: string[];
  /**
   * How much shorter or longer the suggestion is, as a percentage.
   *
   * An objective fact shown beside the model's own description of what it did,
   * because that description is not reliable: asked to halve a section, the
   * first live run returned the text unchanged and reported «скоротив удвічі,
   * прибрав повтор про фестивалі» — a section that never mentioned фестивалі.
   * A reader can check a number against the text in front of them.
   */
  lengthDeltaPct: number;
};

/** Whitespace and case are not a revision. */
function sameText(a: string, b: string): boolean {
  const norm = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();
  return norm(a) === norm(b);
}

/**
 * Ask the assistant to revise one section.
 *
 * Returns the suggestion; saves nothing. Accepting is a separate act by a
 * person, and routing it through `editSection` is what marks the result as
 * human-reviewed. An assistant that wrote directly would leave a section that
 * had been rewritten by a model sitting there labelled as read.
 */
export async function suggestSectionRevision(
  organizationId: string,
  grantId: string,
  key: string,
  instruction: string,
): Promise<SuggestionView> {
  const trimmed = instruction.trim();
  if (trimmed.length === 0) {
    throw new ConceptGenerationFailed("Напишіть, що саме змінити в цій секції.");
  }
  if (trimmed.length > MAX_INSTRUCTION_CHARS) {
    throw new ConceptGenerationFailed(
      `Забагато тексту для інструкції (${trimmed.length} символів). Опишіть коротше, що змінити.`,
    );
  }

  const db = forOrganization(organizationId);
  const draft = await db.conceptDraft.findFirst({
    where: { grantId },
    include: { sections: true },
  });
  const section = draft?.sections.find((s) => s.key === key);
  if (!draft || !section) {
    throw new ConceptGenerationFailed("Цієї секції ще немає — спершу створіть чернетку.");
  }

  const [orgRow, grantRow, donor] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: { facts: { include: { citations: true } } },
    }),
    prisma.grant.findUniqueOrThrow({
      where: { id: grantId },
      include: { rules: { include: { citations: true } } },
    }),
    donorMaterial(organizationId, grantId),
  ]);

  const profile = toProfile(orgRow);
  const grant = toGrant(grantRow);

  const run = await suggestRevision({
    org: profile,
    grant,
    sectionKey: key,
    current: section.content,
    instruction: trimmed,
    donorText: donor.text,
    edited: section.source !== "AI_DRAFT",
  });

  if (!run.suggestion) {
    throw new ConceptGenerationFailed(
      run.error ?? "Не вдалося отримати пропозицію. Спробуйте ще раз.",
    );
  }

  // A suggestion identical to the text it replaces is not a suggestion, and
  // offering it alongside a confident description of what changed is worse than
  // offering nothing: it teaches a grant manager that the change notes are
  // fiction, and after that they stop reading them on the revisions that are
  // real.
  if (sameText(run.suggestion.content, section.content)) {
    throw new ConceptGenerationFailed(
      "Модель не змінила текст. Спробуйте сформулювати конкретніше — наприклад, " +
        "«прибрати другий абзац» або «додати, що працюємо з сільськими громадами».",
    );
  }

  const before = section.content.trim().length;
  const after = run.suggestion.content.trim().length;

  return {
    content: run.suggestion.content,
    changeNoteUk: run.suggestion.changeNoteUk,
    unsupportedFigures: unsupportedNumbers(run.suggestion.content, [
      renderProfileText(profile),
      JSON.stringify(grant),
      donor.text,
    ]),
    lengthDeltaPct: before === 0 ? 0 : Math.round(((after - before) / before) * 100),
  };
}

export type SectionReview = {
  sectionKey: string;
  findings: Finding[];
  /** Spans the model claimed that are not in the text. Counted so it is visible. */
  dropped: number;
};

/**
 * Review one section: rules first, model second.
 *
 * The rules half needs no database, no model and no waiting, so it runs
 * unconditionally and its findings are never lost to a model failure — if the
 * runtime is down, the reviewer still catches the superlatives.
 *
 * Findings from both halves go through one verification gate, so the screen has
 * a single guarantee to draw on: every highlight it renders exists in the text.
 */
export async function reviewConceptSection(
  organizationId: string,
  grantId: string,
  key: string,
  opts: { skipModel?: boolean } = {},
): Promise<SectionReview> {
  const db = forOrganization(organizationId);
  const draft = await db.conceptDraft.findFirst({
    where: { grantId },
    include: { sections: true },
  });
  const section = draft?.sections.find((s) => s.key === key);
  if (!draft || !section) {
    throw new ConceptGenerationFailed("Цієї секції ще немає — спершу створіть чернетку.");
  }

  const fromRules = verifiedFindings(ruleFindings(section.content), section.content);
  if (opts.skipModel) {
    return { sectionKey: key, findings: fromRules, dropped: 0 };
  }

  const [orgRow, grantRow, donor] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: { facts: { include: { citations: true } } },
    }),
    prisma.grant.findUniqueOrThrow({
      where: { id: grantId },
      include: { rules: { include: { citations: true } } },
    }),
    donorMaterial(organizationId, grantId),
  ]);

  const run = await reviewSection({
    org: toProfile(orgRow),
    grant: toGrant(grantRow),
    sectionKey: key,
    content: section.content,
    donorText: donor.text,
  });

  // A model failure degrades the review to its rules half rather than failing
  // it. Half a review is worth having; an error message instead of the
  // superlatives it would have caught is not.
  const findings = [...fromRules, ...run.findings];
  await storeFindings(draft.id, key, section.content, findings);

  return { sectionKey: key, findings, dropped: run.dropped };
}

/** sha256 of a section's text, so a finding can be tied to the words it read. */
export function sectionHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Write this section's findings down, replacing the previous run's.
 *
 * A dismissal outlives the run that produced it. Somebody who has already said
 * «це не помилка» about a sentence should not be asked again every time the
 * review is re-run, so the quotes they rejected are carried forward and the new
 * findings that match one are stored dismissed.
 */
async function storeFindings(
  draftId: string,
  sectionKey: string,
  content: string,
  findings: readonly Finding[],
): Promise<void> {
  const hash = sectionHash(content);

  const dismissed = new Set(
    (
      await prisma.conceptFinding.findMany({
        where: { draftId, sectionKey, dismissedAt: { not: null } },
        select: { category: true, quote: true },
      })
    ).map((f) => `${f.category}:${f.quote}`),
  );

  const now = new Date();
  await prisma.$transaction([
    prisma.conceptFinding.deleteMany({ where: { draftId, sectionKey } }),
    prisma.conceptFinding.createMany({
      data: findings.map((f) => ({
        draftId,
        sectionKey,
        sectionContentHash: hash,
        category: f.category,
        quote: f.quote,
        whyUk: f.whyUk,
        suggestionUk: f.suggestionUk,
        source: f.source,
        dismissedAt: dismissed.has(`${f.category}:${f.quote}`) ? now : null,
      })),
    }),
  ]);
}

/**
 * The findings stored for one draft, minus the ones that no longer apply.
 *
 * Two things hide a finding: a person dismissed it, or the section has been
 * rewritten since it was found. The second is why the hash is stored — a
 * finding points at a span of prose, and prose that changed no longer has that
 * span. Showing it anyway would underline whatever now sits at those offsets.
 */
export async function loadFindings(
  organizationId: string,
  grantId: string,
): Promise<Record<string, Finding[]>> {
  const db = forOrganization(organizationId);
  const draft = await db.conceptDraft.findFirst({
    where: { grantId },
    include: { sections: true, findings: { where: { dismissedAt: null } } },
  });
  if (!draft) return {};

  const hashes = new Map(draft.sections.map((s) => [s.key, sectionHash(s.content)]));

  const bySection: Record<string, Finding[]> = {};
  for (const row of draft.findings) {
    if (hashes.get(row.sectionKey) !== row.sectionContentHash) continue;
    (bySection[row.sectionKey] ??= []).push({
      quote: row.quote,
      category: row.category,
      whyUk: row.whyUk,
      suggestionUk: row.suggestionUk,
      source: row.source,
    });
  }
  return bySection;
}

/**
 * Mark one finding as not a problem.
 *
 * Stored rather than kept in the page, for the same reason the findings are:
 * a judgement a person made should survive a reload, and re-running the review
 * should not ask them to make it again.
 */
export async function dismissFinding(
  organizationId: string,
  grantId: string,
  sectionKey: string,
  category: string,
  quote: string,
): Promise<void> {
  const db = forOrganization(organizationId);
  const draft = await db.conceptDraft.findFirst({ where: { grantId }, select: { id: true } });
  if (!draft) throw new ConceptGenerationFailed("Чернетки ще немає.");

  await prisma.conceptFinding.updateMany({
    where: {
      draftId: draft.id,
      sectionKey,
      quote,
      category: category as Finding["category"],
      dismissedAt: null,
    },
    data: { dismissedAt: new Date() },
  });
}

/**
 * Replace one span in a section.
 *
 * Goes through `editSection`, so applying a suggestion marks the section as the
 * person's — which is true, because they read the finding and chose to accept
 * it. Refuses when the span is no longer there: the text may have been edited in
 * another tab since the review ran, and replacing the first thing that looks
 * similar would silently corrupt someone's writing.
 */
export async function applyFinding(
  organizationId: string,
  grantId: string,
  key: string,
  quote: string,
  replacement: string,
  userId: string,
): Promise<void> {
  const db = forOrganization(organizationId);
  const draft = await db.conceptDraft.findFirst({
    where: { grantId },
    include: { sections: true },
  });
  const section = draft?.sections.find((s) => s.key === key);
  if (!draft || !section) throw new ConceptGenerationFailed("Секції не знайдено.");

  if (!section.content.includes(quote)) {
    throw new ConceptGenerationFailed(
      "Текст змінився відколи виконувалася перевірка. Запустіть її ще раз.",
    );
  }

  await editSection(
    organizationId,
    grantId,
    key,
    section.content.replace(quote, replacement),
    userId,
  );
}

export type ConceptReview = {
  /** Findings for every section, keyed by section. */
  bySection: Record<string, Finding[]>;
  /** Sections the model could not be reached for. Named, not swallowed. */
  failed: string[];
};

/**
 * Review the whole document in one pass.
 *
 * Sequential rather than parallel: one 4 GB card runs one model, and eight
 * concurrent requests would queue inside Ollama anyway while making the failure
 * modes harder to read. The wait is real — roughly six seconds a section — and
 * the screen says so rather than pretending otherwise.
 *
 * A section that fails is named and the rest still return. A review that is
 * all-or-nothing throws away seven good results because the eighth timed out.
 */
export async function reviewWholeConcept(
  organizationId: string,
  grantId: string,
): Promise<ConceptReview> {
  const view = await loadConcept(organizationId, grantId);
  if (!view) throw new ConceptGenerationFailed("Чернетки ще немає.");

  const bySection: Record<string, Finding[]> = {};
  const failed: string[] = [];

  for (const section of view.sections) {
    try {
      const result = await reviewConceptSection(organizationId, grantId, section.key);
      bySection[section.key] = result.findings;
    } catch {
      failed.push(section.key);
    }
  }

  return { bySection, failed };
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

/**
 * Confirm the whole note in one act.
 *
 * The editor used to ask for eight confirmations, one per section, because the
 * data model has eight rows and the screen was built out of them. That is the
 * shape of the storage, not of the reading: nobody reads a concept note section
 * by section and signs off each paragraph, and eight buttons made the
 * confirmation feel like paperwork rather than the moment a person takes
 * responsibility for what the model wrote.
 *
 * One button, one audit entry naming every section it covered. The per-section
 * `approvedAt` stays — the distinction between text a model wrote and text a
 * person has been through is what `human-in-the-loop` turns on, and losing it
 * would leave a draft that can never stop being one. It is now set eight times
 * by one decision instead of eight.
 */
export async function approveConcept(
  organizationId: string,
  grantId: string,
  userId: string,
): Promise<{ approved: number }> {
  const db = forOrganization(organizationId);
  const draft = await db.conceptDraft.findFirst({
    where: { grantId },
    include: { sections: true },
  });
  if (!draft) throw new ConceptGenerationFailed("чернетки ще немає");

  const pending = draft.sections.filter((s) => s.approvedAt === null);
  if (pending.length === 0) return { approved: 0 };

  const now = new Date();
  await prisma.$transaction([
    prisma.conceptSection.updateMany({
      where: { draftId: draft.id, approvedAt: null },
      data: { approvedAt: now },
    }),
    // One entry per section it covered, plus one for the decision itself.
    //
    // `AuditEntry` records state transitions and deliberately has no free-text
    // column, so the list of sections cannot be a note on the draft entry. Kept
    // per-section instead: the trail still says exactly what was confirmed, and
    // it stays the same shape as when each section was confirmed on its own.
    prisma.auditEntry.createMany({
      data: pending.map((section) => ({
        organizationId,
        actorType: "USER" as const,
        actorId: userId,
        action: "concept.section_approved",
        subjectType: "ConceptSection",
        subjectId: `${draft.id}:${section.key}`,
        toState: "APPROVED",
      })),
    }),
    prisma.auditEntry.create({
      data: {
        organizationId,
        actorType: "USER",
        actorId: userId,
        action: "concept.approved",
        subjectType: "ConceptDraft",
        subjectId: draft.id,
        toState: "REVIEWED",
      },
    }),
    prisma.conceptDraft.update({
      where: { id: draft.id },
      data: {
        updatedAt: now,
        status: draft.sections.length === CONCEPT_SECTIONS.length ? "REVIEWED" : "DRAFT",
      },
    }),
  ]);

  return { approved: pending.length };
}
