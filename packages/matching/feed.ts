/**
 * Reading a stored feed back for the UI.
 *
 * Separate from `run.ts` because building the feed costs minutes and reading it
 * must cost milliseconds — a page that renders by calling a model is a page that
 * times out. Everything here is a query over `Match` rows already written.
 *
 * The shape the screens get is the shape `explainable-output` requires: no bare
 * score, every conclusion carrying the evidence it rests on, and the four
 * buckets kept apart because they call for four different actions.
 */

import { forOrganization } from "../db/tenancy";
import { bucketOf } from "../schemas/ladder";
import type { Bucket, UncertaintyReason, Verdict } from "../schemas/verdict";

export type FeedCriterion = {
  ruleKey: string;
  bucket: Bucket;
  verdict: Verdict;
  uncertaintyReason: UncertaintyReason | null;
  rationale: string;
  grantQuote: string;
  profileQuote: string | null;
  missingInformation: string | null;
  /** Which profile field would settle it — the "answer this" action. */
  resolvingFactKey: string | null;
  ruleTextUk: string;
  ruleKind: "MANDATORY" | "PREFERRED" | "EXCLUDED";
};

export type FeedEntry = {
  matchId: string;
  grantId: string;
  titleUk: string;
  donorName: string;
  sourceUrl: string;
  applicationUrl: string | null;
  deadline: Date | null;
  deadlineIsKnown: boolean;
  fundingMax: number | null;
  currency: string | null;

  overall: Verdict;
  matchScore: number;
  recommend: boolean;
  summary: string;
  blockers: string[];
  openQuestions: string[];

  /**
   * How much of the call was actually read, and what was missed.
   *
   * Carried into the feed rather than left in the ingestion tables because it
   * changes what an UNCERTAIN *means*. A criterion nobody could judge because
   * the announcement was thin is a different problem from one nobody could judge
   * because the profile is empty, and only one of them is fixed by the
   * organization.
   */
  extractionConfidence: number;
  extractionNotes: string | null;

  /**
   * A hand-authored fixture, not a live call.
   *
   * Carried to the screen because during trial operation the seeded test grants
   * sit in the same feed as real ones, and an organization that spends a week on
   * a concept for a grant that does not exist has been actively harmed.
   */
  synthetic: boolean;

  criteria: FeedCriterion[];

  /**
   * When the verdict was computed — not when the call appeared.
   *
   * The two come apart every time a profile is edited: that changes the profile
   * version hash, which re-assesses every grant and stamps all of them with a
   * fresh `computedAt`. Anything asking "what is new to this organization" wants
   * `firstSeenAt` instead.
   */
  computedAt: Date;
  /** When ingestion first saw this call. Stable across re-assessment. */
  firstSeenAt: Date;
};

export type Feed = {
  entries: FeedEntry[];
  /** Counts per bucket across the feed, for the summary line. */
  byBucket: Record<Bucket, number>;
};

function emptyBuckets(): Record<Bucket, number> {
  return { MATCHED: 0, POTENTIAL_PROBLEM: 0, NOT_MATCHED: 0, UNKNOWN: 0 };
}

/**
 * The most recent match per grant.
 *
 * More than one can exist: the unique key allows a row per prompt fingerprint
 * and per input hash, which is deliberate — it keeps the history of what was
 * decided on which inputs. The feed shows the current one.
 */
export async function loadFeed(
  organizationId: string,
  opts: { recommendedOnly?: boolean; limit?: number } = {},
): Promise<Feed> {
  const db = forOrganization(organizationId);

  const rows = await db.match.findMany({
    orderBy: [{ computedAt: "desc" }],
    take: opts.limit ?? 200,
    include: {
      grant: { include: { rules: true } },
      assessments: true,
    },
  });

  const seen = new Set<string>();
  const entries: FeedEntry[] = [];
  const byBucket = emptyBuckets();

  for (const row of rows) {
    if (seen.has(row.grantId)) continue;
    seen.add(row.grantId);

    // After the dedup, never in the query. A grant keeps its older match rows
    // by design, so filtering on `recommend` before the dedup lets a superseded
    // row stand in for the current verdict: the newest match says no, the query
    // hides it, and the one below it still says yes. The digest is the only
    // caller, which makes that the difference between a quiet week and mailing
    // an organization a call it is no longer recommended for.
    if (opts.recommendedOnly && !row.recommend) continue;

    const criteria: FeedCriterion[] = row.assessments.map((a) => {
      const rule = row.grant.rules.find((r) => r.id === a.ruleId);
      const bucket = bucketOf({
        ruleKey: rule?.key ?? "",
        kind: rule?.kind ?? "MANDATORY",
        verdict: a.verdict,
        uncertaintyReason: a.uncertaintyReason,
        resolvingFactState: null,
      });
      byBucket[bucket] += 1;

      return {
        ruleKey: rule?.key ?? "",
        bucket,
        verdict: a.verdict,
        uncertaintyReason: a.uncertaintyReason,
        rationale: a.rationale,
        grantQuote: a.grantQuote,
        profileQuote: a.profileQuote,
        missingInformation: a.missingInformation,
        resolvingFactKey: a.resolvingFactKey,
        ruleTextUk: rule?.textUk ?? rule?.text ?? "",
        ruleKind: rule?.kind ?? "MANDATORY",
      };
    });

    entries.push({
      matchId: row.id,
      grantId: row.grantId,
      titleUk: row.grant.titleUk ?? row.grant.title,
      donorName: row.grant.donorName,
      sourceUrl: row.grant.sourceUrl,
      applicationUrl: row.grant.applicationUrl,
      deadline: row.grant.deadline,
      deadlineIsKnown: row.grant.deadlineIsKnown,
      fundingMax: row.grant.fundingMax === null ? null : Number(row.grant.fundingMax),
      currency: row.grant.currency,

      overall: row.overall,
      matchScore: row.matchScore,
      recommend: row.recommend,
      summary: row.summary,
      blockers: row.blockers,
      openQuestions: row.openQuestions,

      extractionConfidence: row.grant.extractionConfidence,
      extractionNotes: row.grant.extractionNotes,
      synthetic: row.grant.synthetic,

      criteria: criteria.sort((a, b) => {
        // Blocking problems first, then what the organization can act on, then
        // what already fits. A feed that leads with good news buries the work.
        const order: Record<Bucket, number> = {
          NOT_MATCHED: 0,
          POTENTIAL_PROBLEM: 1,
          UNKNOWN: 2,
          MATCHED: 3,
        };
        return order[a.bucket] - order[b.bucket];
      }),
      computedAt: row.computedAt,
      firstSeenAt: row.grant.firstSeenAt,
    });
  }

  // Recommended first, then by deadline urgency, then by fit. A grant closing in
  // three days outranks a better fit closing in three months.
  entries.sort((a, b) => {
    if (a.recommend !== b.recommend) return a.recommend ? -1 : 1;
    const aDue = a.deadlineIsKnown && a.deadline ? a.deadline.getTime() : Infinity;
    const bDue = b.deadlineIsKnown && b.deadline ? b.deadline.getTime() : Infinity;
    if (aDue !== bDue) return aDue - bDue;
    return b.matchScore - a.matchScore;
  });

  return { entries, byBucket };
}

export async function loadMatch(
  organizationId: string,
  grantId: string,
): Promise<FeedEntry | null> {
  const feed = await loadFeed(organizationId, { limit: 500 });
  return feed.entries.find((e) => e.grantId === grantId) ?? null;
}
