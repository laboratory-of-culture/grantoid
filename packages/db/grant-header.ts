/**
 * What the editor needs to know about a call, without an assessment.
 *
 * The editor used to load a `Match` row and 404 when there wasn't one. That was
 * survivable while every call came from ingestion — the nightly run assesses
 * everything it finds, so a match always existed by the time anyone clicked. It
 * stopped being survivable the moment an organization could bring its own call:
 * `createGrantFromDocument` writes a Grant and redirects to the editor, and the
 * editor answered the redirect with "page not found". The one path where the
 * organization did the most work was the one path that led nowhere.
 *
 * The deeper mistake was reading the conditions off our own verdict. A call's
 * terms are the donor's, and they exist whether or not anybody has judged the
 * organization against them; a concept is written against the terms either way.
 * So the editor loads the grant, and treats the assessment as commentary that
 * may or may not have happened yet.
 */

import { prisma } from "./tenancy";

export type WritingHeader = {
  grantId: string;
  titleUk: string;
  donorName: string;
  deadline: Date | null;
  deadlineIsKnown: boolean;
  extractionConfidence: number;
  synthetic: boolean;
  /** Set when the organization supplied this call itself. */
  privateToOrganization: boolean;
  rules: { key: string; textUk: string; kind: "MANDATORY" | "PREFERRED" | "EXCLUDED" }[];
};

/**
 * Load one call for writing against, scoped to who may see it.
 *
 * Not routed through the tenancy extension: `Grant` is a shared table, so the
 * extension has no organization column to filter on and the scoping has to be
 * written out. It is the same clause the feed uses — public calls, plus the ones
 * this organization owns — and getting it wrong here would hand an NGO a
 * competition it was never invited to.
 */
export async function loadGrantForWriting(
  organizationId: string,
  grantId: string,
): Promise<WritingHeader | null> {
  const grant = await prisma.grant.findFirst({
    where: {
      id: grantId,
      OR: [{ ownerOrganizationId: null }, { ownerOrganizationId: organizationId }],
    },
    select: {
      id: true,
      title: true,
      titleUk: true,
      donorName: true,
      deadline: true,
      deadlineIsKnown: true,
      extractionConfidence: true,
      synthetic: true,
      ownerOrganizationId: true,
      rules: {
        orderBy: { orderIndex: "asc" },
        select: { key: true, text: true, textUk: true, kind: true },
      },
    },
  });
  if (!grant) return null;

  return {
    grantId: grant.id,
    titleUk: grant.titleUk ?? grant.title,
    donorName: grant.donorName,
    deadline: grant.deadline,
    deadlineIsKnown: grant.deadlineIsKnown,
    extractionConfidence: grant.extractionConfidence,
    synthetic: grant.synthetic,
    privateToOrganization: grant.ownerOrganizationId !== null,
    rules: grant.rules.map((r) => ({
      key: r.key,
      textUk: r.textUk ?? r.text,
      kind: r.kind,
    })),
  };
}
