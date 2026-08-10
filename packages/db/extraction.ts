/**
 * Running an extraction over a stored document and staging what it found.
 *
 * Everything the agent proposes lands as a `FactCandidate`, never as an
 * `OrganizationFact`. The promotion happens in the confirmation queue, when a
 * person decides — see `org-knowledge-base`.
 */

import type { Prisma } from "@prisma/client";

import { extract } from "../../agents/knowledge";
import { extractText } from "../documents/text";
import { documentStore } from "./documents";
import { prisma, type ScopedClient } from "./tenancy";

export class ExtractionFailed extends Error {}

export type ExtractionSummary = {
  documentId: string;
  proposed: number;
  /** Proposals dropped because their quotation was not in the document. */
  discarded: number;
  unreadable: boolean;
  latencyMs: number;
};

/**
 * Extract facts from one document the caller owns.
 *
 * Re-running replaces the pending candidates for that document: a second run
 * after a prompt or model change should not leave the reviewer looking at two
 * generations of proposals. Already-resolved candidates are left alone, because
 * a person's decision is not the agent's to revisit.
 */
export async function extractDocumentFacts(
  db: ScopedClient,
  documentId: string,
): Promise<ExtractionSummary> {
  const doc = await db.document.findFirst({ where: { id: documentId } });
  if (!doc) {
    throw new ExtractionFailed("Документ не належить цій організації.");
  }

  const bytes = await documentStore().get(doc.storageKey);
  const { text, pageCount, emptyReason } = await extractText(doc.mimeType, bytes);

  if (emptyReason) {
    await prisma.document.update({
      where: { id: doc.id },
      data: { extractionError: emptyReason, extractedAt: new Date(), pageCount },
    });
    throw new ExtractionFailed(emptyReason);
  }

  const run = await extract(doc.filename, doc.kind, text);

  if (run.error) {
    await prisma.document.update({
      where: { id: doc.id },
      data: { extractionError: run.error },
    });
    throw new ExtractionFailed(
      "Не вдалося опрацювати документ. Спробуйте ще раз або завантажте інший файл.",
    );
  }

  await prisma.factCandidate.deleteMany({
    where: { documentId: doc.id, status: "PENDING" },
  });

  if (run.facts.length > 0) {
    const data: Prisma.FactCandidateCreateManyInput[] = run.facts.map((f) => ({
      organizationId: doc.organizationId,
      documentId: doc.id,
      key: f.key,
      state: f.state,
      valueText: f.valueText,
      quote: f.quote,
      page: f.page,
      confidence: f.confidence,
    }));
    await prisma.factCandidate.createMany({ data });
  }

  await prisma.document.update({
    where: { id: doc.id },
    data: {
      extractedAt: new Date(),
      extractionError: null,
      pageCount: pageCount ?? doc.pageCount,
    },
  });

  return {
    documentId: doc.id,
    proposed: run.facts.length,
    discarded: run.discarded.length,
    unreadable: run.unreadable,
    latencyMs: run.usage.latencyMs,
  };
}
