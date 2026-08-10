/**
 * What the Organization Knowledge agent returns.
 *
 * Two schemas, per `agent-authoring`: the shape constrains decoding, the
 * semantic one runs after and rejects what constrained decoding cannot see.
 */

import { z } from "zod";

import { FACT_KEYS } from "../../packages/schemas/fact-registry";

/**
 * One fact read out of a document.
 *
 * `state` deliberately excludes CONFIRMED. Extraction never confirms anything —
 * only a person clicking confirm does, and that is what gates a fact into an
 * application (see `org-knowledge-base`). An agent that could emit CONFIRMED
 * would be able to write unreviewed claims into a funding application.
 */
export const ExtractedFactShape = z.object({
  key: z
    .enum(FACT_KEYS as [string, ...string[]])
    .describe("A key from the fact registry. Do not invent keys."),
  state: z
    .enum(["SELF_REPORTED", "EXPLICIT_NEGATIVE"])
    .describe(
      "SELF_REPORTED when the document states the fact. EXPLICIT_NEGATIVE when " +
        "it states the organization does NOT have or do this.",
    ),
  valueText: z
    .string()
    .describe("The value in plain Ukrainian, as short as it can be and still exact."),
  quote: z
    .string()
    .describe(
      "The sentence from the document this was read from, verbatim. Not a summary.",
    ),
  page: z.number().nullable().describe("Page number if known, otherwise null."),
  confidence: z
    .number()
    .describe("0 to 1. How certain the document settles this, not how likely it is true."),
});

export const ExtractionShape = z.object({
  facts: z
    .array(ExtractedFactShape)
    .describe(
      "Only facts the document actually settles. Return an empty list rather than " +
        "guessing — an unanswered field costs one question later, a wrong one costs " +
        "a rejected application.",
    ),
  documentSummary: z
    .string()
    .describe("One sentence in Ukrainian: what this document is."),
  unreadable: z
    .boolean()
    .describe("True if the text is too garbled or too short to read facts from."),
});
export type ExtractionShape = z.infer<typeof ExtractionShape>;

export const Extraction = ExtractionShape.superRefine((e, ctx) => {
  e.facts.forEach((f, i) => {
    if (f.quote.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["facts", i, "quote"],
        message: "a fact without its source sentence cannot enter the knowledge base",
      });
    }
    if (f.valueText.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["facts", i, "valueText"],
        message: "empty value",
      });
    }
    if (f.confidence < 0 || f.confidence > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["facts", i, "confidence"],
        message: "confidence must be between 0 and 1",
      });
    }
  });

  const seen = new Set<string>();
  for (const f of e.facts) {
    if (seen.has(f.key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["facts"],
        message: `two values extracted for "${f.key}" — the document cannot settle it twice`,
      });
    }
    seen.add(f.key);
  }
});
export type Extraction = z.infer<typeof Extraction>;
