/**
 * The organization profile (brief §6–§7).
 *
 * The shape here encodes docs/DECISIONS.md D4: a profile is a complete map from
 * every registry key to a `FactState`, not a bag of the fields somebody happened
 * to fill in. "Nobody has asked" is a value, so the eligibility agent never has
 * to infer it from an absent key.
 */

import { z } from "zod";

import { FACT_KEYS, FactKey } from "./fact-registry";
import { Citation } from "./grant";
import { FactState } from "./verdict";

/** Ukrainian legal forms. An enum, not free text — see the `ua-locale` skill. */
export const LegalForm = z.enum([
  "GROMADSKA_ORGANIZATSIYA",
  "BLAHODIYNA_ORGANIZATSIYA",
  "GROMADSKA_SPILKA",
  "KOMUNALNYI_ZAKLAD",
  "RELIHIYNA_ORGANIZATSIYA",
  "INSHE",
]);
export type LegalForm = z.infer<typeof LegalForm>;

export const LEGAL_FORM_LABEL_UK: Record<LegalForm, string> = {
  GROMADSKA_ORGANIZATSIYA: "Громадська організація (ГО)",
  BLAHODIYNA_ORGANIZATSIYA: "Благодійна організація (БО)",
  GROMADSKA_SPILKA: "Громадська спілка",
  KOMUNALNYI_ZAKLAD: "Комунальний заклад",
  RELIHIYNA_ORGANIZATSIYA: "Релігійна організація",
  INSHE: "Інше",
};

/**
 * One profile field and what we know about it.
 *
 * The four states are not degrees of confidence — they are different kinds of
 * knowledge, and they license different verdicts:
 *
 *   UNKNOWN            never asked → can only ever yield UNCERTAIN
 *   SELF_REPORTED      the org said so → informs a match, cannot enter an application
 *   CONFIRMED          backed by a citation and confirmed by a human → fully usable
 *   EXPLICIT_NEGATIVE  the org confirmed it does NOT have this → the only basis
 *                      for NOT_ELIGIBLE
 */
export const OrganizationFact = z
  .object({
    key: FactKey,
    state: FactState,
    valueText: z.string().nullable().default(null),
    valueList: z.array(z.string()).nullable().default(null),
    valueNumber: z.number().nullable().default(null),
    valueBoolean: z.boolean().nullable().default(null),
    confidence: z.number().min(0).max(1).nullable().default(null),
    citations: z.array(Citation).default([]),
    confirmedAt: z.string().datetime({ offset: true }).nullable().default(null),
  })
  .superRefine((f, ctx) => {
    const hasValue =
      f.valueText !== null ||
      f.valueList !== null ||
      f.valueNumber !== null ||
      f.valueBoolean !== null;

    if (f.state === "UNKNOWN" && hasValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["state"],
        message:
          "an UNKNOWN fact carries no value — if there is a value, the state is SELF_REPORTED or CONFIRMED",
      });
    }
    if (f.state === "CONFIRMED" && f.confirmedAt === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmedAt"],
        message: "CONFIRMED requires the timestamp of the human confirmation",
      });
    }
    if (f.state === "CONFIRMED" && f.citations.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["citations"],
        message:
          "CONFIRMED requires at least one citation — a fact without provenance cannot enter an application",
      });
    }
  });
export type OrganizationFact = z.infer<typeof OrganizationFact>;

export const OrganizationProfile = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    nameEn: z.string().nullable().default(null),

    /** ЄДРПОУ — exactly 8 digits. */
    edrpou: z
      .string()
      .regex(/^\d{8}$/, "ЄДРПОУ має містити рівно 8 цифр")
      .nullable()
      .default(null),

    legalForm: LegalForm.nullable().default(null),
    oblast: z.string().nullable().default(null),
    city: z.string().nullable().default(null),
    websiteUrl: z.string().url().nullable().default(null),
    mission: z.string().nullable().default(null),

    facts: z.array(OrganizationFact),

    /** Hand-authored test record. Describes no real organization. */
    synthetic: z.boolean().default(false),
  })
  .superRefine((o, ctx) => {
    const seen = new Set(o.facts.map((f) => f.key));
    if (seen.size !== o.facts.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["facts"],
        message: "duplicate fact keys",
      });
    }
    const missing = FACT_KEYS.filter((k) => !seen.has(k));
    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["facts"],
        message:
          `profile is missing a row for: ${missing.join(", ")}. ` +
          "Every registry key needs a row, defaulting to UNKNOWN — an absent row " +
          "and a stored UNKNOWN are different things (DECISIONS.md D4).",
      });
    }
  });
export type OrganizationProfile = z.infer<typeof OrganizationProfile>;

/** A complete set of UNKNOWN facts. What a new organization starts with. */
export function emptyFacts(): OrganizationFact[] {
  return FACT_KEYS.map((key) => ({
    key,
    state: "UNKNOWN" as const,
    valueText: null,
    valueList: null,
    valueNumber: null,
    valueBoolean: null,
    confidence: null,
    citations: [],
    confirmedAt: null,
  }));
}

/** Share of registry keys that have been answered. Drives onboarding progress. */
export function completeness(facts: readonly OrganizationFact[]): number {
  if (facts.length === 0) return 0;
  const answered = facts.filter((f) => f.state !== "UNKNOWN").length;
  return answered / facts.length;
}

export function factByKey(
  profile: OrganizationProfile,
  key: string,
): OrganizationFact | undefined {
  return profile.facts.find((f) => f.key === key);
}
