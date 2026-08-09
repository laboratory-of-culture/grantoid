/**
 * The canonical grant record (brief §10).
 *
 * Every component that reads or writes a grant validates against these schemas
 * — scraper, extractor, matcher, API route, UI prop type. Redeclaring a grant's
 * fields inline is the drift the `grant-schema` skill exists to prevent.
 */

import { z } from "zod";

import { FactKey } from "./fact-registry";
import { RuleKind } from "./verdict";

/**
 * Where a fact came from. `quote` is required — a citation that cannot show its
 * words is not a citation, and the UI cites rather than asserts.
 */
export const Citation = z.object({
  quote: z.string().min(1, "a citation must carry the verbatim text"),
  url: z.string().url().nullable().default(null),
  document: z.string().nullable().default(null),
  page: z.number().int().positive().nullable().default(null),
  retrievedAt: z.string().datetime({ offset: true }).or(z.string().date()),
});
export type Citation = z.infer<typeof Citation>;

export const GrantStatus = z.enum(["OPEN", "CLOSED", "UPCOMING", "UNKNOWN"]);
export type GrantStatus = z.infer<typeof GrantStatus>;

/**
 * Funding terms.
 *
 * `cofinancingRequired: null` means the call was not read on this point — not
 * that co-financing is absent. Both real House of Europe fixtures carry nulls
 * here, because the public page does not say and the guidelines PDF was not
 * fetched. Rendering null as "no co-financing required" would be a fabrication.
 */
export const Funding = z.object({
  min: z.number().nonnegative().nullable().default(null),
  max: z.number().nonnegative().nullable().default(null),
  currency: z.string().length(3).nullable().default(null),
  cofinancingRequired: z.boolean().nullable().default(null),
  maxSharePct: z.number().min(0).max(100).nullable().default(null),
});
export type Funding = z.infer<typeof Funding>;

/**
 * One requirement the applicant is judged against.
 *
 * `resolvingFactKey` is what turns a diagnosis into an action: it names the
 * profile field that would settle this rule, which is how the match breakdown
 * offers «додати міжнародного партнера до профілю» instead of only reporting
 * that something is unknown.
 */
export const EligibilityRule = z.object({
  key: z
    .string()
    .regex(/^[a-z0-9-]+$/, "slug: lowercase, digits and hyphens only"),
  text: z.string().min(1),
  textUk: z.string().nullable().default(null),
  kind: RuleKind,
  orderIndex: z.number().int().nonnegative().default(0),
  resolvingFactKey: FactKey.nullable().default(null),
  citation: Citation.nullable().default(null),
});
export type EligibilityRule = z.infer<typeof EligibilityRule>;

export const Grant = z
  .object({
    id: z.string().min(1),
    sourceId: z.string().min(1).nullable().default(null),
    externalKey: z.string().min(1),

    title: z.string().min(1),
    titleUk: z.string().nullable().default(null),
    donorName: z.string().min(1),
    sourceUrl: z.string().url().nullable().default(null),
    applicationUrl: z.string().url().nullable().default(null),

    status: GrantStatus.default("UNKNOWN"),
    /** null means unread. Pair with `deadlineIsKnown` before showing urgency. */
    deadline: z.string().date().nullable().default(null),
    deadlineIsKnown: z.boolean().default(false),

    funding: Funding.default({}),

    applicantTypes: z.array(z.string()).default([]),
    applicantGeography: z.array(z.string()).default([]),
    sectors: z.array(z.string()).default([]),
    themes: z.array(z.string()).default([]),
    targetGroups: z.array(z.string()).default([]),
    applicationLanguage: z.string().nullable().default(null),

    eligibility: z.array(EligibilityRule).default([]),
    requiredDocuments: z.array(z.string()).default([]),
    evaluationCriteria: z.array(z.string()).default([]),

    /** How much of the call was actually read, 0–1. Not how good the fit is. */
    extractionConfidence: z.number().min(0).max(1).default(0),
    /** What was left unread. Shown next to any verdict it could affect. */
    extractionNotes: z.string().nullable().default(null),

    /** Hand-authored test record. Never describes a live funding call. */
    synthetic: z.boolean().default(false),

    retrievedAt: z.string().datetime({ offset: true }).or(z.string().date()),
  })
  .superRefine((g, ctx) => {
    if (g.deadlineIsKnown && g.deadline === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deadline"],
        message: "deadlineIsKnown is true but no deadline was extracted",
      });
    }
    if (g.funding.min !== null && g.funding.max !== null && g.funding.min > g.funding.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["funding"],
        message: "funding.min exceeds funding.max",
      });
    }
    const keys = g.eligibility.map((r) => r.key);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eligibility"],
        message: "eligibility rule keys must be unique within a grant",
      });
    }
  });
export type Grant = z.infer<typeof Grant>;
