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
    // Kept only when it is a real http(s) link. The private-grant path extracts
    // from a donor's PDF, and the model there returns the file name as a
    // `file://…pdf` URL — invalid, and the canonical Grant schema's `.url()`
    // rejects it, so one such value is a grant that throws when the matcher
    // parses it (the same failure the currency field had). Coerced to null here
    // rather than stored, at the boundary both ingest paths pass through.
    .transform((u) => {
      const t = u?.trim();
      if (!t) return null;
      try {
        const url = new URL(t);
        return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
      } catch {
        return null;
      }
    })
    .describe("A link to the donor's own page or application form, if given. http(s) only."),

  deadline: z
    .string()
    .nullable()
    .describe("YYYY-MM-DD, only if the announcement states a date. Null otherwise."),

  fundingMin: z.number().nullable(),
  fundingMax: z.number().nullable(),
  currency: z
    .string()
    .nullable()
    // The model returns the *word* "null" often enough — a qwen3 slip — and the
    // occasional «грн» or «$», and the canonical Grant schema requires exactly a
    // three-letter code. One such value stored is one grant that throws when the
    // matcher parses it, and because grants are shared that one throw took down
    // the whole nightly matching pass for every organisation after it. Coerced
    // to a clean ISO-ish code or real null here, at the one boundary both the
    // crawl and the private-grant path pass through, so nothing invalid is ever
    // written.
    .transform((c) => {
      const up = c?.trim().toUpperCase();
      return up && /^[A-Z]{3}$/.test(up) ? up : null;
    })
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

/**
 * Deliberately *not* refined on the deadline's format.
 *
 * The first live run lost two complete grant records to
 * `deadline must be YYYY-MM-DD` — the model wrote the date in a Ukrainian form,
 * and a schema rejection threw away the donor, the sums, the sectors and every
 * eligibility rule along with it. On a stage whose whole premise is that records
 * arrive incomplete, one malformed field must degrade that field and nothing
 * else. Normalisation and corroboration happen in `index.ts`, where a date that
 * cannot be read becomes null and says so.
 */
export const ExtractedGrant = ExtractedGrantShape.superRefine((g, ctx) => {
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
