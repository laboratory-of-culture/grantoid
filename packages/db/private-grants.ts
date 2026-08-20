/**
 * A call an organization received directly, not one we found.
 *
 * Donors mail PDFs. A grant manager gets an invitation to a closed competition,
 * or guidelines for a call that was never published on ГУРТ or Простір, and
 * until now the product had nothing to say to them: the editor only opened on a
 * grant ingestion had found.
 *
 * The record is owned rather than shared. `Grant` is a public table by design —
 * everyone sees the same calls — and dropping a privately-received one in
 * unscoped would show every other NGO a competition they were not invited to,
 * and tell them who else is applying. So `ownerOrganizationId` is set, and every
 * read that builds a feed filters on it.
 */

import { createHash } from "node:crypto";

import { extractGrant } from "../../agents/extraction";
import { extractText } from "../documents/text";
import { MAX_ARTICLE_CHARS } from "../ingestion/article";
import { documentStore } from "./documents";
import { prisma } from "./tenancy";

export class PrivateGrantFailed extends Error {}

const ACCEPTED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
]);

/** 20 MB, the same ceiling as every other upload in the product. */
const MAX_BYTES = 20 * 1024 * 1024;

export type PrivateGrantResult = {
  grantId: string;
  titleUk: string;
  rules: number;
  extractionConfidence: number;
  notes: string[];
};

/**
 * Read a donor document and make a call out of it.
 *
 * The same extraction agent that reads an announcement page, pointed at a PDF
 * instead. That reuse is the point: a call is a call, and the guarantees the
 * agent already carries — a rule dropped unless its quote is in the source, a
 * date discarded unless the text contains it, a confidence computed from
 * coverage rather than claimed — apply here without being restated.
 *
 * One difference, and it favours this path: guidelines are the donor's own
 * words, not a notice about them. The announcement ceiling of 0.75 exists
 * because the guidelines had not been read; here they are the input.
 */
export async function createGrantFromDocument(
  organizationId: string,
  input: { filename: string; mimeType: string; bytes: Uint8Array },
): Promise<PrivateGrantResult> {
  if (input.bytes.byteLength === 0) {
    throw new PrivateGrantFailed("Файл порожній. Виберіть інший.");
  }
  if (input.bytes.byteLength > MAX_BYTES) {
    throw new PrivateGrantFailed("Файл більший за 20 МБ. Стисніть його або надішліть частинами.");
  }
  if (!ACCEPTED.has(input.mimeType)) {
    throw new PrivateGrantFailed("Підтримуються PDF, DOCX, DOC і TXT.");
  }

  const { text, emptyReason, pageCount } = await extractText(input.mimeType, input.bytes);
  if (emptyReason || text.trim().length === 0) {
    throw new PrivateGrantFailed(
      emptyReason ??
        "З файлу не вдалося прочитати текст. Якщо це скан, потрібна версія з текстовим шаром.",
    );
  }

  const truncated = text.length > MAX_ARTICLE_CHARS;
  const run = await extractGrant(
    text.slice(0, MAX_ARTICLE_CHARS),
    `file://${input.filename}`,
    input.filename,
    truncated,
  );

  if (!run.result) {
    throw new PrivateGrantFailed(
      run.error ?? "Не вдалося розібрати документ. Спробуйте ще раз.",
    );
  }
  if (!run.result.isGrant) {
    throw new PrivateGrantFailed(
      "Прочитавши документ, система не побачила в ньому грантового конкурсу. " +
        "Якщо це все ж конкурс, відкрийте його вручну через стрічку.",
    );
  }

  const g = run.result;
  const now = new Date();
  const contentHash = createHash("sha256").update(text).digest("hex");

  // Same document twice is the same call, not a second one.
  const existing = await prisma.grant.findFirst({
    where: { ownerOrganizationId: organizationId, contentHash },
    select: { id: true },
  });
  if (existing) {
    throw new PrivateGrantFailed("Цей документ уже завантажено — конкурс із нього вже створено.");
  }

  // The file first, then both rows together.
  //
  // Ordering learned the hard way: creating the grant and then storing the file
  // left, when the store threw, a call with no document behind it — and the
  // duplicate check then refused every retry, so the organization was stuck with
  // an empty record it could not replace. An orphaned file is the cheaper
  // failure: nothing points at it, and deleting the organization sweeps it.
  const stored = await documentStore().put(organizationId, input.filename, input.bytes);

  const grant = await prisma.$transaction(async (tx) => {
    const created = await tx.grant.create({
      data: {
        sourceId: null,
        ownerOrganizationId: organizationId,
        externalKey: `private:${contentHash.slice(0, 16)}`,
        title: g.titleUk,
        titleUk: g.titleUk,
        donorName: g.donorName ?? "Донор не вказаний у документі",
        sourceUrl: "",
        applicationUrl: g.applicationUrl,
        status: g.deadline ? "OPEN" : "UNKNOWN",
        deadline: g.deadline ? new Date(g.deadline) : null,
        deadlineIsKnown: g.deadline !== null,
        fundingMin: g.fundingMin,
        fundingMax: g.fundingMax,
        currency: g.currency,
        cofinancingRequired: g.cofinancingRequired,
        applicantTypes: g.applicantTypes,
        applicantGeography: g.applicantGeography,
        sectors: g.sectors,
        themes: [],
        targetGroups: g.targetGroups,
        extractionConfidence: run.confidence,
        extractionNotes: run.notes.join("\n"),
        contentHash,
        retrievedAt: now,
        lastCheckedAt: now,
        rules: {
          create: g.eligibility.map((rule, i) => ({
            key: rule.resolvingFactKey?.replace(/_/g, "-") ?? `rule-${i}`,
            text: rule.text,
            textUk: rule.text,
            kind: rule.kind,
            orderIndex: i,
            resolvingFactKey: rule.resolvingFactKey,
            citations: { create: [{ quote: rule.quote, retrievedAt: now }] },
          })),
        },
      },
    });

    // Attached to the call it produced, so the terms the concept is written
    // against stay readable rather than being summarised once and discarded.
    await tx.document.create({
      data: {
        organizationId,
        kind: "CALL_GUIDELINES",
        grantId: created.id,
        filename: input.filename,
        storageKey: stored.key,
        mimeType: input.mimeType,
        sizeBytes: stored.sizeBytes,
        pageCount,
        contentHash,
        extractedAt: now,
      },
    });

    return created;
  });

  await prisma.auditEntry.create({
    data: {
      organizationId,
      actorType: "USER",
      action: "grant.created_from_document",
      subjectType: "Grant",
      subjectId: grant.id,
      toState: "PRIVATE",
    },
  });

  return {
    grantId: grant.id,
    titleUk: g.titleUk,
    rules: g.eligibility.length,
    extractionConfidence: run.confidence,
    notes: run.notes,
  };
}
