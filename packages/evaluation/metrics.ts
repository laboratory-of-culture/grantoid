/**
 * Eval metrics for the eligibility agent.
 *
 * Five numbers, reported together. A run that reports feed precision alone is
 * not an eval: a model that says "eligible" more often moves it in the right
 * direction while getting more organizations rejected wrongly.
 */

import { quoteAppearsIn } from "../schemas/match";
import type { MatchResult } from "../schemas/match";
import { distance, type Verdict } from "../schemas/verdict";

const POSITIVE: ReadonlySet<Verdict> = new Set<Verdict>(["MATCH", "LIKELY_MATCH"]);
const NEGATIVE: ReadonlySet<Verdict> = new Set<Verdict>([
  "LIKELY_NOT_ELIGIBLE",
  "NOT_ELIGIBLE",
]);

export type PairOutcome = {
  org: string;
  grant: string;
  goldOverall: Verdict;
  predOverall: Verdict | null;
  goldRecommend: boolean;
  predRecommend: boolean | null;
  criteria: {
    ruleKey: string;
    gold: Verdict;
    pred: Verdict | null;
  }[];
  citedQuotes: number;
  verbatimQuotes: number;
  error: string | null;
  latencyMs: number;
  promptTokens: number;
  outputTokens: number;
};

export type Report = {
  pairs: number;
  failed: number;
  falseEligibleRate: number;
  unknownCollapseRate: number;
  evidenceCitationRate: number;
  feedPrecision: number;
  feedRecall: number;
  criterionExact: number;
  criterionAdjacent: number;
  overallExact: number;
  medianLatencyMs: number;
};

/** Compare one agent run against its gold label. */
export function scorePair(args: {
  org: string;
  grant: string;
  goldOverall: Verdict;
  goldRecommend: boolean;
  goldCriteria: Record<string, Verdict>;
  result: MatchResult | null;
  grantText: string;
  error: string | null;
  latencyMs: number;
  promptTokens: number;
  outputTokens: number;
}): PairOutcome {
  const { result } = args;

  let citedQuotes = 0;
  let verbatimQuotes = 0;
  const criteria: PairOutcome["criteria"] = [];

  for (const [ruleKey, gold] of Object.entries(args.goldCriteria)) {
    const found = result?.criteria.find((c) => c.ruleKey === ruleKey);
    criteria.push({ ruleKey, gold, pred: found?.verdict ?? null });
  }

  for (const c of result?.criteria ?? []) {
    if (c.grantQuote.trim().length > 0) {
      citedQuotes += 1;
      if (quoteAppearsIn(c.grantQuote, args.grantText)) verbatimQuotes += 1;
    }
  }

  return {
    org: args.org,
    grant: args.grant,
    goldOverall: args.goldOverall,
    predOverall: result?.overall ?? null,
    goldRecommend: args.goldRecommend,
    predRecommend: result?.recommend ?? null,
    criteria,
    citedQuotes,
    verbatimQuotes,
    error: args.error,
    latencyMs: args.latencyMs,
    promptTokens: args.promptTokens,
    outputTokens: args.outputTokens,
  };
}

export function report(outcomes: readonly PairOutcome[]): Report {
  const scored = outcomes.filter((o) => o.predOverall !== null);
  const failed = outcomes.length - scored.length;

  /**
   * The metric that ships harm: gold says the organization is ruled out (or
   * nearly), the model says it fits. Treat any rise as a release blocker.
   */
  const goldNegative = scored.filter((o) => NEGATIVE.has(o.goldOverall));
  const falseEligible = goldNegative.filter((o) => POSITIVE.has(o.predOverall!));

  /**
   * The characteristic small-model failure: gold says we do not know, the model
   * commits. Rises quietly — the JSON stays valid throughout.
   */
  const goldUncertain = scored.filter((o) => o.goldOverall === "UNCERTAIN");
  const collapsed = goldUncertain.filter((o) => o.predOverall !== "UNCERTAIN");

  const totalCited = scored.reduce((n, o) => n + o.citedQuotes, 0);
  const totalVerbatim = scored.reduce((n, o) => n + o.verbatimQuotes, 0);

  const recommended = scored.filter((o) => o.predRecommend === true);
  const relevantRecommended = recommended.filter((o) => o.goldRecommend);
  const goldRecommended = scored.filter((o) => o.goldRecommend);

  const allCriteria = scored.flatMap((o) => o.criteria).filter((c) => c.pred !== null);
  const exact = allCriteria.filter((c) => c.pred === c.gold);
  const adjacent = allCriteria.filter((c) => distance(c.pred!, c.gold) <= 1);

  const overallExact = scored.filter((o) => o.predOverall === o.goldOverall);

  const latencies = [...outcomes.map((o) => o.latencyMs)].sort((a, b) => a - b);
  const mid = Math.floor(latencies.length / 2);

  return {
    pairs: outcomes.length,
    failed,
    falseEligibleRate: ratio(falseEligible.length, goldNegative.length),
    unknownCollapseRate: ratio(collapsed.length, goldUncertain.length),
    evidenceCitationRate: ratio(totalVerbatim, totalCited),
    feedPrecision: ratio(relevantRecommended.length, recommended.length),
    feedRecall: ratio(relevantRecommended.length, goldRecommended.length),
    criterionExact: ratio(exact.length, allCriteria.length),
    criterionAdjacent: ratio(adjacent.length, allCriteria.length),
    overallExact: ratio(overallExact.length, scored.length),
    medianLatencyMs: latencies.length === 0 ? 0 : (latencies[mid] ?? 0),
  };
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? Number.NaN : numerator / denominator;
}

export function formatReport(r: Report): string {
  const pct = (v: number) => (Number.isNaN(v) ? "  n/a" : `${(v * 100).toFixed(0).padStart(4)}%`);

  return [
    `pairs                   ${r.pairs}  (${r.failed} produced no usable output)`,
    "",
    "  the two that gate a release",
    `    false-eligible       ${pct(r.falseEligibleRate)}   gold rules them out, model says they fit`,
    `    unknown-collapse     ${pct(r.unknownCollapseRate)}   gold says we don't know, model commits`,
    "",
    "  honesty of the evidence",
    `    verbatim citations   ${pct(r.evidenceCitationRate)}   grant quote actually appears in the call`,
    "",
    "  usefulness of the feed",
    `    precision            ${pct(r.feedPrecision)}`,
    `    recall               ${pct(r.feedRecall)}`,
    "",
    "  agreement with the labels",
    `    overall verdict      ${pct(r.overallExact)}   exact`,
    `    per criterion        ${pct(r.criterionExact)}   exact`,
    `    per criterion        ${pct(r.criterionAdjacent)}   within one rung`,
    "",
    `  median latency         ${(r.medianLatencyMs / 1000).toFixed(1)}s per pair`,
  ].join("\n");
}
