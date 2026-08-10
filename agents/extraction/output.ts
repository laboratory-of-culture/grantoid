/**
 * What the grant extraction agent may return.
 *
 * Everything is nullable, and that is the point. An aggregator announcement is
 * a paragraph pointing at a donor's page; it routinely omits the deadline, the
 * co-financing rule and the project duration, and those live in a PDF nobody has
 * read at this stage. A schema that required them would get them invented.
 */

import { z } from "zod";

import { FACT_KEYS } from "../../packages/schemas/fact-registry";

export const ExtractedRuleShape = z.object({
  text: z
    .string()
    .describe("The requirement in one sentence, in Ukrainian, as the call states it."),
  kind: z
    .enum(["MANDATORY", "PREFERRED", "EXCLUDED"])
    .describe(
      "MANDATORY gates eligibility. PREFERRED only affects ranking. EXCLUDED describes who or what is ruled out.",
    ),
  quote: z
    .string()
    .describe("The sentence from the announcement this was read from, verbatim."),
  resolvingFactKey: z
    .enum(FACT_KEYS as [string, ...string[]])
    .nullable()
    .describe(
      "The single organization profile field that settles this rule, or null when the rule is judged from the profile as a whole.",
    ),
});

export const ExtractedGrantShape = z.object({
  isGrant: z
    .boolean()
    .describe(
      "False if, having read the full page, this turns out not to be a funding call after all.",
    ),

  titleUk: z.string().describe("The call's name in Ukrainian."),
  donorName: z
    .string()
    .nullable()
    .describe("Who is funding, if the announcement names them. Not the aggregator."),
  applicationUrl: z
    .string()
    .nullable()
    .describe("A link to the donor's own page or application form, if given."),

  deadline: z
    .string()
    .nullable()
    .describe("YYYY-MM-DD, only if the announcement states a date. Null otherwise."),

  fundingMin: z.number().nullable(),
  fundingMax: z.number().nullable(),
  currency: z
    .string()
    .nullable()
    .describe("Three-letter code: UAH, EUR, USD."),
  cofinancingRequired: z
    .boolean()
    .nullable()
    .describe("Null unless the announcement actually says. Null is not 'no'."),

  sectors: z.array(z.string()).describe("Fields of activity, in Ukrainian."),
  targetGroups: z.array(z.string()).describe("Who the project must serve."),
  applicantTypes: z.array(z.string()).describe("Who may apply, as the call words it."),
  applicantGeography: z.array(z.string()).describe("Where the applicant must be based or work."),

  eligibility: z
    .array(ExtractedRuleShape)
    .describe("Only requirements the announcement actually states."),

  summaryUk: z.string().describe("Two sentences a grant manager can scan."),

  notReadFromSource: z
    .array(z.string())
    .describe(
      "Decision-relevant things this announcement does not state — deadline, co-financing, duration, budget. Name them; do not guess them.",
    ),
});
export type ExtractedGrant = z.infer<typeof ExtractedGrantShape>;

export const ExtractedGrant = ExtractedGrantShape.superRefine((g, ctx) => {
  if (g.deadline !== null && !/^\d{4}-\d{2}-\d{2}$/.test(g.deadline)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["deadline"],
      message: "deadline must be YYYY-MM-DD or null",
    });
  }
  if (g.fundingMin !== null && g.fundingMax !== null && g.fundingMin > g.fundingMax) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["fundingMin"],
      message: "fundingMin exceeds fundingMax",
    });
  }
  g.eligibility.forEach((rule, i) => {
    if (rule.quote.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eligibility", i, "quote"],
        message: "a rule without its source sentence cannot be shown to a user",
      });
    }
  });
});
