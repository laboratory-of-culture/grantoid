/**
 * Roll-up and the guard rails around a single verdict.
 *
 * Pure functions over plain data, deliberately: this logic is the product's
 * central claim, and it should be testable without a database, a model, or a
 * request. See `ladder.test.ts`, which was written first.
 */

import {
  Bucket,
  FactState,
  RuleKind,
  UncertaintyReason,
  Verdict,
  rank,
} from "./verdict";

/**
 * One criterion, reduced to what the ladder needs to reason about it.
 *
 * `resolvingFactState` is the state of the single profile fact that settles this
 * rule, or null when no single fact does — a sector-fit judgement reads the
 * profile as a whole. Null means inference is legitimate; UNKNOWN means the
 * question was never asked and inference is not.
 */
export type Assessed = {
  ruleKey: string;
  kind: RuleKind;
  verdict: Verdict;
  uncertaintyReason: UncertaintyReason | null;
  resolvingFactState: FactState | null;
};

/** Rules that gate eligibility. PREFERRED moves the score only. */
function gates(kind: RuleKind): boolean {
  return kind === "MANDATORY" || kind === "EXCLUDED";
}

/**
 * The overall verdict: the worst gating criterion.
 *
 * Not an average, not a weighted sum. The ladder is ordinal — one established
 * blocker rules an organization out however well everything else fits, and
 * averaging would hide exactly that.
 *
 * With nothing gating to judge, the answer is UNCERTAIN rather than MATCH. An
 * empty assessment is an absence of evidence, and this function will not turn
 * that into a positive claim.
 */
export function rollUp(assessments: readonly Assessed[]): Verdict {
  const gating = assessments.filter((a) => gates(a.kind));
  if (gating.length === 0) return "UNCERTAIN";

  let worst: Verdict = "MATCH";
  for (const a of gating) {
    if (rank(a.verdict) > rank(worst)) worst = a.verdict;
  }
  return worst;
}

/**
 * Which verdicts a resolving fact in this state can support.
 *
 * This is docs/DECISIONS.md D4 as code. An unanswered field supports exactly one
 * verdict — UNCERTAIN — in either direction: it cannot rule an organization out,
 * and it cannot rule one in either.
 */
export function permittedVerdicts(state: FactState | null): Verdict[] {
  switch (state) {
    case "UNKNOWN":
      return ["UNCERTAIN"];
    case "EXPLICIT_NEGATIVE":
      return ["NOT_ELIGIBLE", "LIKELY_NOT_ELIGIBLE", "UNCERTAIN"];
    case "CONFIRMED":
    case "SELF_REPORTED":
    case null:
      // A confirmed fact, a self-reported one, or a rule judged from the whole
      // profile can land anywhere on the ladder.
      return [...Verdict.options];
  }
}

/**
 * Throws when an assessment claims more than its evidence allows.
 *
 * Called on every criterion before it is persisted. The eligibility agent is a
 * language model and will occasionally reach past its evidence; this is the
 * layer that refuses to write that down.
 */
export function assertVerdictPermitted(a: Assessed): void {
  const allowed = permittedVerdicts(a.resolvingFactState);
  if (!allowed.includes(a.verdict)) {
    throw new Error(
      `Rule ${a.ruleKey}: verdict ${a.verdict} is not supported by a resolving ` +
        `fact in state ${a.resolvingFactState}. Permitted: ${allowed.join(", ")}. ` +
        `An unanswered profile field can only ever yield UNCERTAIN.`,
    );
  }

  if (a.verdict === "UNCERTAIN" && a.uncertaintyReason === null) {
    throw new Error(
      `Rule ${a.ruleKey}: UNCERTAIN needs a reason. NO_PROFILE_DATA offers the ` +
        `user a profile action; AMBIGUOUS_CALL and CONFLICTING_EVIDENCE do not.`,
    );
  }
}

/**
 * Which of the four breakdown buckets a criterion belongs to.
 *
 * The split inside UNCERTAIN is the point: NO_PROFILE_DATA is something the
 * organization can fix in an afternoon, so it gets its own bucket with an
 * action. An ambiguous call is a reading task and sits with the soft negatives.
 */
export function bucketOf(a: Assessed): Bucket {
  switch (a.verdict) {
    case "MATCH":
    case "LIKELY_MATCH":
      return "MATCHED";
    case "NOT_ELIGIBLE":
      return "NOT_MATCHED";
    case "LIKELY_NOT_ELIGIBLE":
      return "POTENTIAL_PROBLEM";
    case "UNCERTAIN":
      return a.uncertaintyReason === "NO_PROFILE_DATA"
        ? "UNKNOWN"
        : "POTENTIAL_PROBLEM";
  }
}

/**
 * Whether a grant belongs in the organization's feed.
 *
 * An open question is not a reason to hide a grant — it is a reason to show it
 * with the question attached. An established blocker is. The feed is judged on
 * precision, so this deliberately errs toward fewer, better rows.
 */
export function shouldRecommend(assessments: readonly Assessed[]): boolean {
  const overall = rollUp(assessments);
  return overall !== "NOT_ELIGIBLE" && overall !== "LIKELY_NOT_ELIGIBLE";
}
