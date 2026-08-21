/**
 * Building one organization's feed.
 *
 * The order of operations is the design. Load the candidates, run the
 * deterministic gate over all of them, reuse any verdict whose inputs have not
 * changed, and only then spend 82 seconds a pair on what is left. Each of those
 * three steps exists to keep the last one small.
 *
 * Nothing here decides what an organization sees — that is the ladder's job and
 * it has already been decided by the time a `Match` row is written. This module
 * only makes sure the decision is made on current inputs and stored once.
 */

import { assess } from "../../agents/eligibility";
import { forOrganization, prisma } from "../db/tenancy";
import { shouldRecommend } from "../schemas/ladder";
import { grantInputHash, profileVersionHash, toGrant, toProfile } from "./adapters";
import { prefilter, type FilterableGrant, type FilterableOrganization } from "./prefilter";

export type MatchOutcome = {
  organizationId: string;
  candidates: number;
  /** Settled by the deterministic gate, with no model call. */
  filtered: number;
  /** Answered from an existing Match whose inputs are unchanged. */
  reused: number;
  assessed: number;
  failed: number;
  recommended: number;
  durationMs: number;
  errors: { grantId: string; title: string; error: string }[];
  /**
   * Every deterministic exclusion, with its reason.
   *
   * Kept rather than counted because a filter that silently drops grants is the
   * one failure mode this module cannot detect from the outside: an
   * over-eager rule and a genuinely irrelevant corpus produce the same number.
   */
  excluded: { grantId: string; title: string; rule: string; reasonUk: string }[];
};

/**
 * The profile fields the pre-filter reads, pulled out of the fact rows.
 *
 * `null` and `[]` mean different things here and the difference is load-bearing:
 * null is "never answered" and passes everything, `[]` would be "answered with
 * nothing" which is not a state this product has. So an UNKNOWN fact must map to
 * null, not to an empty array.
 */
export function filterableProfile(profile: {
  oblast: string | null;
  legalForm: string | null;
  facts: readonly {
    key: string;
    state: string;
    valueList: string[] | null;
    valueText: string | null;
  }[];
}): FilterableOrganization {
  const listFor = (key: string): string[] | null => {
    const fact = profile.facts.find((f) => f.key === key);
    if (!fact || fact.state === "UNKNOWN") return null;
    if (fact.valueList !== null) return fact.valueList;
    return fact.valueText ? [fact.valueText] : null;
  };

  return {
    sectors: listFor("sectors") ?? listFor("activity_areas"),
    geography: listFor("geographic_coverage"),
    legalForm: profile.legalForm,
    oblast: profile.oblast,
  };
}

export async function matchOrganization(
  organizationId: string,
  opts: { limit?: number; now?: Date } = {},
): Promise<MatchOutcome> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const db = forOrganization(organizationId);

  const row = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    include: { facts: { include: { citations: true } } },
  });
  const profile = toProfile(row);
  const versionHash = profileVersionHash(profile);
  const filterable = filterableProfile(profile);

  // Closed calls are excluded in the gate rather than the query, so the count
  // of what was filtered and why stays honest.
  const grantRows = await prisma.grant.findMany({
    where: {
      // Public calls, plus the ones this organization supplied itself. Donors
      // mail PDFs, and a call that arrived in one NGO's inbox was never
      // published anywhere — matching every organization against it would show
      // them a competition they were not invited to and tell them who else is
      // in it. `Grant` is a shared table, so the filter has to be written here
      // rather than assumed from the scoped client.
      OR: [{ ownerOrganizationId: null }, { ownerOrganizationId: organizationId }],
    },
    include: { rules: { include: { citations: true } } },
    orderBy: { deadline: "asc" },
    take: opts.limit ?? 200,
  });

  const outcome: MatchOutcome = {
    organizationId,
    candidates: grantRows.length,
    filtered: 0,
    reused: 0,
    assessed: 0,
    failed: 0,
    recommended: 0,
    durationMs: 0,
    errors: [],
    excluded: [],
  };

  for (const grantRow of grantRows) {
    const filterableGrant: FilterableGrant = {
      id: grantRow.id,
      sectors: grantRow.sectors,
      applicantGeography: grantRow.applicantGeography,
      applicantTypes: grantRow.applicantTypes,
      deadline: grantRow.deadline,
      deadlineIsKnown: grantRow.deadlineIsKnown,
      status: grantRow.status,
    };

    const gate = prefilter(filterable, filterableGrant, now);
    if (!gate.pass) {
      outcome.filtered += 1;
      outcome.excluded.push({
        grantId: grantRow.id,
        title: grantRow.titleUk ?? grantRow.title,
        rule: gate.rule,
        reasonUk: gate.reasonUk,
      });
      continue;
    }

    // A verdict is reusable only when the prompt, the call's own fields and the
    // profile are all the ones that produced it. Not the announcement text: the
    // page can be identical while what we read out of it is not. The unique key
    // enforces the same thing at the database level; this check is what avoids
    // paying for the call.
    const inputHash = grantInputHash(grantRow);
    const existing = await db.match.findFirst({
      where: {
        grantId: grantRow.id,
        grantInputHash: inputHash,
        profileVersionHash: versionHash,
      },
      select: { id: true, recommend: true },
    });
    if (existing) {
      outcome.reused += 1;
      if (existing.recommend) outcome.recommended += 1;
      continue;
    }

    try {
      const grant = toGrant(grantRow);
      const run = await assess(profile, grant);

      if (!run.result) {
        outcome.failed += 1;
        outcome.errors.push({
          grantId: grantRow.id,
          title: grantRow.titleUk ?? grantRow.title,
          error: run.error ?? "no output",
        });
        continue;
      }

      const result = run.result;

      // The agent returns `recommend`, and the ladder decides it. Two gates,
      // independently: a verdict that is not a rejection *and* a score above the
      // floor. Without the score floor a sparse profile floods the feed with
      // UNCERTAIN rows, which was found while writing the gold labels.
      const byKey = new Map(grant.eligibility.map((r) => [r.key, r]));
      const recommend = shouldRecommend(
        result.criteria.map((c) => {
          const rule = byKey.get(c.ruleKey);
          const factKey = rule?.resolvingFactKey ?? null;
          const fact = factKey ? profile.facts.find((f) => f.key === factKey) : undefined;
          return {
            ruleKey: c.ruleKey,
            kind: rule?.kind ?? "MANDATORY",
            verdict: c.verdict,
            uncertaintyReason: c.uncertaintyReason,
            resolvingFactState: fact?.state ?? null,
          };
        }),
        result.matchScore,
      );

      // Rule keys come back from a model, so a criterion may name a rule that
      // does not exist. Those are dropped rather than written against a
      // fabricated id — an assessment must point at a real clause.
      const ruleIds = new Map(grantRow.rules.map((r) => [r.key, r.id]));
      const assessments = result.criteria.filter((c) => ruleIds.has(c.ruleKey));

      await db.match.create({
        data: {
          organizationId,
          grantId: grantRow.id,
          overall: result.overall,
          matchScore: result.matchScore,
          recommend,
          summary: result.summary,
          blockers: result.blockers,
          openQuestions: result.openQuestions,
          modelTag: run.usage.model,
          promptFingerprint: run.promptFingerprint,
          numCtx: run.usage.numCtx,
          seed: run.usage.seed,
          inputTokens: run.usage.promptTokens,
          outputTokens: run.usage.outputTokens,
          latencyMs: run.usage.latencyMs,
          grantInputHash: inputHash,
          profileVersionHash: versionHash,
          assessments: {
            create: assessments.map((c) => ({
              ruleId: ruleIds.get(c.ruleKey) as string,
              verdict: c.verdict,
              uncertaintyReason: c.uncertaintyReason,
              rationale: c.rationale,
              grantQuote: c.grantQuote,
              profileQuote: c.profileQuote,
              missingInformation: c.missingInformation,
              resolvingFactKey: byKey.get(c.ruleKey)?.resolvingFactKey ?? null,
            })),
          },
        },
      });

      outcome.assessed += 1;
      if (recommend) outcome.recommended += 1;
    } catch (err) {
      // One bad grant must not abandon the rest of the feed.
      outcome.failed += 1;
      outcome.errors.push({
        grantId: grantRow.id,
        title: grantRow.titleUk ?? grantRow.title,
        error: String(err),
      });
    }
  }

  outcome.durationMs = Date.now() - started;
  return outcome;
}
