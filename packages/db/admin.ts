/**
 * What an operator may see about the organizations using the product.
 *
 * **Activity, not content.** Counts, states and dates; never the text of a
 * concept note, never a fact's value, never a line of an uploaded document.
 * The operational question is whether the system is working for somebody, and
 * that is answered by «profile 12/18, four documents, one extraction failed,
 * nothing generated in three weeks». Reading their application to find that out
 * is surveillance with no operational need, and `pii-and-donor-data` draws the
 * line here rather than leaving it to whoever builds the next screen.
 *
 * Document filenames are the one piece of metadata that survives the rule. An
 * operator helping with «my file did not work» needs to know which file, and
 * the name is already in the error log.
 *
 * Unscoped by construction: this is the one module that reads across
 * organizations, so it uses the raw client and every caller must be behind
 * `requireAdmin`.
 */

import { prisma } from "./tenancy";
import { FACT_KEYS } from "../schemas/fact-registry";

export type OrgSummary = {
  id: string;
  name: string;
  legalForm: string | null;
  oblast: string | null;
  createdAt: Date;

  /** Answered registry fields out of the registry's size. */
  answered: number;
  totalFields: number;

  documents: number;
  /** Uploaded but never turned into candidate facts, or failed. */
  documentsUnread: number;

  members: number;
  /** Current verdicts in the feed, and how many are worth acting on. */
  matches: number;
  recommended: number;

  drafts: number;
  draftsConfirmed: number;

  /** The most recent thing anybody did, across every table that records one. */
  lastActivity: Date | null;
};

/**
 * Every organization, with enough to tell a working one from a stalled one.
 *
 * One query per aggregate rather than a correlated subquery each: five round
 * trips against tables this size is cheaper than the alternative and far easier
 * to read. If the operator list ever runs long enough for that to matter, the
 * fix is a view, not a cleverer query here.
 */
export async function listOrganizations(): Promise<OrgSummary[]> {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      facts: {
        where: { key: { in: FACT_KEYS } },
        select: { key: true, state: true, valueText: true, updatedAt: true },
      },
      documents: {
        select: { extractedAt: true, extractionError: true, uploadedAt: true },
      },
      concepts: { select: { status: true, updatedAt: true } },
      _count: { select: { memberships: true, matches: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const recommendedByOrg = new Map(
    (
      await prisma.match.groupBy({
        by: ["organizationId"],
        where: { recommend: true },
        _count: true,
      })
    ).map((row) => [row.organizationId, row._count]),
  );

  return orgs.map((org) => {
    const answered = org.facts.filter((f) => f.state !== "UNKNOWN").length;

    // Two different problems, one number: a document nobody has run extraction
    // on, and one where extraction failed. Both mean the organization is not
    // getting what it uploaded, which is what an operator is looking for.
    const documentsUnread = org.documents.filter(
      (d) => d.extractedAt === null || d.extractionError !== null,
    ).length;

    const times = [
      org.updatedAt,
      ...org.facts.map((f) => f.updatedAt),
      ...org.documents.map((d) => d.uploadedAt),
      ...org.concepts.map((c) => c.updatedAt),
    ].filter((d): d is Date => d instanceof Date);

    return {
      id: org.id,
      name: org.name,
      legalForm: org.facts.find((f) => f.key === "legal_form")?.valueText ?? null,
      oblast: org.facts.find((f) => f.key === "registration_oblast")?.valueText ?? null,
      createdAt: org.createdAt,

      answered,
      totalFields: FACT_KEYS.length,

      documents: org.documents.length,
      documentsUnread,

      members: org._count.memberships,
      matches: org._count.matches,
      recommended: recommendedByOrg.get(org.id) ?? 0,

      drafts: org.concepts.length,
      draftsConfirmed: org.concepts.filter((c) => c.status === "REVIEWED").length,

      lastActivity: times.length > 0 ? new Date(Math.max(...times.map((t) => t.getTime()))) : null,
    };
  });
}

export type OrgDetail = OrgSummary & {
  members: number;
  emails: string[];
  /** Verdict distribution across the current feed. */
  verdicts: { verdict: string; count: number }[];
  documentRows: {
    id: string;
    filename: string;
    kind: string;
    sizeBytes: number;
    uploadedAt: Date;
    extractedAt: Date | null;
    extractionError: string | null;
  }[];
  /** What happened, in the audit log's own words. No content, only actions. */
  trail: { at: Date; action: string; actorType: string; toState: string | null }[];
};

export async function loadOrganization(id: string): Promise<OrgDetail | null> {
  const summary = (await listOrganizations()).find((o) => o.id === id);
  if (!summary) return null;

  const [members, verdicts, documentRows, trail] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId: id },
      select: { user: { select: { email: true } } },
    }),
    prisma.match.groupBy({
      by: ["overall"],
      where: { organizationId: id },
      _count: true,
    }),
    prisma.document.findMany({
      where: { organizationId: id },
      select: {
        id: true,
        filename: true,
        kind: true,
        sizeBytes: true,
        uploadedAt: true,
        extractedAt: true,
        extractionError: true,
      },
      orderBy: { uploadedAt: "desc" },
    }),
    prisma.auditEntry.findMany({
      where: { organizationId: id },
      select: { at: true, action: true, actorType: true, toState: true },
      orderBy: { at: "desc" },
      take: 40,
    }),
  ]);

  return {
    ...summary,
    emails: members.map((m) => m.user.email),
    verdicts: verdicts
      .map((v) => ({ verdict: v.overall as string, count: v._count }))
      .sort((a, b) => b.count - a.count),
    documentRows,
    trail,
  };
}

/** Numbers for the top of the operator's screen. */
export async function systemSummary(): Promise<{
  organizations: number;
  users: number;
  liveGrants: number;
  syntheticGrants: number;
  matches: number;
  drafts: number;
  /** Organizations that have done nothing for a fortnight. */
  quiet: number;
}> {
  const fortnightAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const orgs = await listOrganizations();

  const [users, liveGrants, syntheticGrants, matches, drafts] = await Promise.all([
    prisma.user.count(),
    prisma.grant.count({ where: { synthetic: false } }),
    prisma.grant.count({ where: { synthetic: true } }),
    prisma.match.count(),
    prisma.conceptDraft.count(),
  ]);

  return {
    organizations: orgs.length,
    users,
    liveGrants,
    syntheticGrants,
    matches,
    drafts,
    quiet: orgs.filter((o) => o.lastActivity === null || o.lastActivity < fortnightAgo).length,
  };
}
