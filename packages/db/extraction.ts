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

/**
 * A page number the document actually has, or none.
 *
 * The model reports the page it read a quote from, and it guesses. A two-page
 * annual report came back with three facts cited to «с. 4» — a page that does
 * not exist, printed beside a verbatim quote that did, on the one screen whose
 * entire claim is that every fact carries where it came from. A citation nobody
 * checked is a citation that can be invented; this is the same rule the grant
 * extractor applies to its quotes, applied to the other half of the reference.
 *
 * Dropping the number rather than the fact: the quote is checked separately and
 * is the stronger evidence. «Ми не знаємо, на якій сторінці» is honest and
 * still useful. «Сторінка 4» of a two-page file is neither.
 */
export function citedPage(page: number | null, pageCount: number | null): number | null {
  if (page === null || !Number.isInteger(page) || page < 1) return null;
  if (pageCount !== null && page > pageCount) return null;
  return page;
}

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

  // A donor's guidelines describe a call, not this organization. Reading facts
  // out of them would file another grant's co-financing rule as a property of
  // the NGO — a quiet corruption of the knowledge base that nothing downstream
  // could detect, since the fact would look as well-sourced as any other.
  if (doc.grantId !== null) {
    throw new ExtractionFailed(
      "Це документ донора, а не документ вашої організації. З нього не витягуються факти профілю.",
    );
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
    const pages = pageCount ?? doc.pageCount;
    const data: Prisma.FactCandidateCreateManyInput[] = run.facts.map((f) => ({
      organizationId: doc.organizationId,
      documentId: doc.id,
      key: f.key,
      state: f.state,
      valueText: f.valueText,
      quote: f.quote,
      page: citedPage(f.page, pages),
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
