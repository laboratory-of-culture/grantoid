/**
 * The eligibility agent's output contract.
 *
 * Two jobs, and they are deliberately separated:
 *
 *   `MatchResultShape` is what gets converted to JSON Schema and handed to
 *   Ollama's `format` to constrain decoding. It describes *shape* only —
 *   constrained decoding cannot enforce that a quote is verbatim or that an
 *   UNCERTAIN verdict was justified.
 *
 *   `MatchResult` adds the semantic rules on top and runs after parsing. This
 *   is where a verdict that reached past its evidence gets rejected rather than
 *   written to the database.
 */

import { z } from "zod";

import { UncertaintyReason, Verdict } from "./verdict";

export const CriterionAssessmentShape = z.object({
  ruleKey: z.string().describe("The key of the eligibility rule assessed."),
  verdict: Verdict,
  uncertaintyReason: UncertaintyReason.nullable().describe(
    "Required when the verdict is UNCERTAIN, null otherwise.",
  ),
  rationale: z
    .string()
    .describe("Two sentences at most. Say why, not what."),
  grantQuote: z
    .string()
    .describe(
      "Verbatim text from the grant that establishes this requirement. Do not paraphrase.",
    ),
  profileQuote: z
    .string()
    .nullable()
    .describe(
      "Verbatim text from the organization profile that settles the requirement. " +
        "Null when the profile does not address it.",
    ),
  missingInformation: z
    .string()
    .nullable()
    .describe(
      "What the organization would need to supply. Required when the verdict is " +
        "UNCERTAIN, null otherwise.",
    ),
});

export const MatchResultShape = z.object({
  grantId: z.string(),
  organizationId: z.string(),
  overall: Verdict.describe(
    "The floor of the mandatory criteria — the worst mandatory verdict, not an average.",
  ),
  matchScore: z
    .number()
    .int()
    .describe(
      "0-100. Fit on the merits — sector, scale, target group, experience — ignoring hard blockers.",
    ),
  recommend: z
    .boolean()
    .describe(
      "Whether this belongs in the organization's feed. True for a plausible fit with " +
        "open questions; false when a hard blocker is established.",
    ),
  summary: z.string().describe("Two or three sentences a grant manager can act on."),
  blockers: z.array(z.string()).describe("Established hard disqualifiers."),
  openQuestions: z
    .array(z.string())
    .describe("Unresolved requirements, phrased as questions for the organization."),
  criteria: z
    .array(CriterionAssessmentShape)
    .describe("One entry per mandatory and excluded rule in the grant."),
});
export type MatchResultShape = z.infer<typeof MatchResultShape>;

/**
 * Shape plus the rules a model can satisfy syntactically and still get wrong.
 *
 * These are the failures worth catching at the boundary rather than in review:
 * a definite verdict with no profile evidence behind it, an UNCERTAIN with
 * nothing telling the user how to resolve it, and a score outside its range.
 */
export const MatchResult = MatchResultShape.superRefine((m, ctx) => {
  if (m.matchScore < 0 || m.matchScore > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["matchScore"],
      message: "matchScore must be between 0 and 100",
    });
  }

  m.criteria.forEach((c, i) => {
    if (c.verdict === "UNCERTAIN") {
      if (c.uncertaintyReason === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["criteria", i, "uncertaintyReason"],
          message: "UNCERTAIN requires a reason so the UI knows which action to offer",
        });
      }
      if (c.missingInformation === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["criteria", i, "missingInformation"],
          message: "UNCERTAIN must say what would resolve it",
        });
      }
    } else if (c.profileQuote === null) {
      // A definite verdict with nothing quoted from the profile is the shape a
      // hallucinated eligibility call takes.
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["criteria", i, "profileQuote"],
        message:
          `verdict ${c.verdict} on "${c.ruleKey}" cites no profile evidence — ` +
          "a verdict this definite needs a quotation, or it should be UNCERTAIN",
      });
    }

    if (c.grantQuote.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["criteria", i, "grantQuote"],
        message: "every criterion must quote the grant text it was judged against",
      });
    }
  });
});
export type MatchResult = z.infer<typeof MatchResult>;

/**
 * Whether a quoted span actually occurs in the source text.
 *
 * Cheap, and it catches the failure mode that matters most: a fluent, plausible
 * quotation the donor never wrote. Whitespace is normalized because models
 * reflow line breaks; nothing else is.
 */
export function quoteAppearsIn(quote: string, source: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const q = norm(quote);
  return q.length > 0 && norm(source).includes(q);
}
