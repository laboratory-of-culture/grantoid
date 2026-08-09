/**
 * The confidence ladder and the enums that surround it.
 *
 * Five rungs, not six — see docs/DECISIONS.md D2. The ladder is ordinal: the
 * overall verdict of a match is the *floor* of its mandatory criteria, which
 * needs a total order. `UncertaintyReason` carries the distinction a sixth rung
 * would have carried, without breaking that order.
 */

import { z } from "zod";

/** Ordered best to worst. The order is load-bearing — see `rank`. */
export const VERDICTS = [
  "MATCH",
  "LIKELY_MATCH",
  "UNCERTAIN",
  "LIKELY_NOT_ELIGIBLE",
  "NOT_ELIGIBLE",
] as const;

export const Verdict = z.enum(VERDICTS);
export type Verdict = z.infer<typeof Verdict>;

/**
 * Why a criterion came out UNCERTAIN. This is what the UI buckets on:
 * NO_PROFILE_DATA is the only reason that yields a "complete your profile"
 * action, because it is the only one the organization can fix.
 */
export const UncertaintyReason = z.enum([
  "NO_PROFILE_DATA",
  "AMBIGUOUS_CALL",
  "CONFLICTING_EVIDENCE",
]);
export type UncertaintyReason = z.infer<typeof UncertaintyReason>;

export const RuleKind = z.enum(["MANDATORY", "PREFERRED", "EXCLUDED"]);
export type RuleKind = z.infer<typeof RuleKind>;

/**
 * The state of one profile field.
 *
 * UNKNOWN exists so that "nobody has asked this organization" is a stored value
 * rather than an absent row — docs/DECISIONS.md D4. EXPLICIT_NEGATIVE is the
 * only state that can justify a NOT_ELIGIBLE verdict.
 */
export const FactState = z.enum([
  "UNKNOWN",
  "SELF_REPORTED",
  "CONFIRMED",
  "EXPLICIT_NEGATIVE",
]);
export type FactState = z.infer<typeof FactState>;

/** The four buckets a match breakdown is grouped into. */
export const Bucket = z.enum([
  "MATCHED", // Відповідає
  "POTENTIAL_PROBLEM", // Потенційна проблема
  "NOT_MATCHED", // Не відповідає
  "UNKNOWN", // Невідомо
]);
export type Bucket = z.infer<typeof Bucket>;

/** Position on the ladder. Lower is better. */
export function rank(verdict: Verdict): number {
  return VERDICTS.indexOf(verdict);
}

/** Rungs between two verdicts. 0 means exact agreement. */
export function distance(a: Verdict, b: Verdict): number {
  return Math.abs(rank(a) - rank(b));
}

export function isPositive(verdict: Verdict): boolean {
  return verdict === "MATCH" || verdict === "LIKELY_MATCH";
}

export function isNegative(verdict: Verdict): boolean {
  return verdict === "LIKELY_NOT_ELIGIBLE" || verdict === "NOT_ELIGIBLE";
}

/** Ukrainian labels. The UI never renders the enum value itself. */
export const VERDICT_LABEL_UK: Record<Verdict, string> = {
  MATCH: "Відповідає",
  LIKELY_MATCH: "Імовірно відповідає",
  UNCERTAIN: "Невідомо",
  LIKELY_NOT_ELIGIBLE: "Імовірно не відповідає",
  NOT_ELIGIBLE: "Не відповідає",
};

export const BUCKET_LABEL_UK: Record<Bucket, string> = {
  MATCHED: "Відповідає",
  POTENTIAL_PROBLEM: "Потенційна проблема",
  NOT_MATCHED: "Не відповідає",
  UNKNOWN: "Невідомо",
};
