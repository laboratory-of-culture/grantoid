/**
 * The writing reviewer.
 *
 * Finds what rules cannot: a claim the inputs do not support, and material that
 * does not answer the section's question. Everything decidable by looking —
 * empty superlatives, vague compounds, forty-word sentences — is found in
 * `packages/schemas/writing-checks.ts` without a model call, per D5.
 *
 * The output is a list of spans, not a rewrite. That is the whole difference
 * from the assistant: this one points, and a person decides. A finding whose
 * span is not in the section is dropped before it reaches the screen, which is
 * the same rule that guards a citation — a highlight the screen cannot draw is
 * a claim it must not make.
 *
 * Empty tool allowlist. It reads a donor PDF somebody uploaded, which is the
 * least trusted input in the product.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import { complete, type CompleteOptions, type Usage } from "../../packages/llm/ollama";
import { sectionDefinition } from "../../packages/schemas/concept";
import { isEmptySetProse } from "../../packages/schemas/locale-uk";
import { renderProfileText } from "../../packages/schemas/profile-text";
import { verifiedFindings, type Finding } from "../../packages/schemas/writing-checks";
import type { Grant } from "../../packages/schemas/grant";
import type { OrganizationProfile } from "../../packages/schemas/organization";

export const TOOLS: readonly string[] = [];

const PROMPT_PATH = path.join(process.cwd(), "agents", "reviewer", "prompt.md");

/**
 * Donor material the reviewer sees.
 *
 * Same budget as the assistant and for the same reason: this runs while someone
 * waits, and judging one paragraph does not need the whole guidelines PDF. The
 * terms that decide whether a claim is supported sit near the front.
 */
export const MAX_REVIEWER_DONOR_CHARS = 5_000;

/**
 * Past this, the model stops pointing and starts editorialising.
 *
 * Measured behaviour of small models on open-ended critique: asked for
 * "problems", they will always find more. Truncating is honest — the first
 * findings are the ones it was most confident about — and it caps the noise a
 * person has to dismiss.
 */
export const MAX_FINDINGS = 4;

/**
 * Sections where a claim can be checked against the profile at all.
 *
 * A concept note is mostly about a project that does not exist yet. «Ми
 * проведемо чотири експедиції» is not in the profile because nothing about the
 * future is, and neither is «мешканці сіл не мають доступу до інформації» —
 * a profile holds facts about an NGO, not a description of the world.
 *
 * Only the capacity section makes claims the profile can contradict: what this
 * organization already has and has already done.
 */
const CHECKABLE_AGAINST_PROFILE = new Set(["capacity"]);

/** A specific figure is checkable everywhere, because it commits the applicant. */
const HAS_FIGURE = /\d/u;

/**
 * Keep an unsupported-claim finding only where it can be true.
 *
 * The prompt says this, and a 4B model does not follow it: told plainly not to
 * flag problem statements, the first live run flagged every sentence of the
 * problem section with «профіль не містить даних про те, що…» — which is a
 * category error, and the fastest way to get a reviewer switched off.
 *
 * So it is enforced rather than asked for, the same way the eligibility ladder
 * is (D5). Dropped rather than downgraded: there is no honest second category
 * for "the model misunderstood what it was checking".
 */
export function keepsUnsupported(sectionKey: string, quote: string): boolean {
  if (CHECKABLE_AGAINST_PROFILE.has(sectionKey)) return true;
  return HAS_FIGURE.test(quote);
}

export function systemPrompt(): string {
  return readFileSync(PROMPT_PATH, "utf8");
}

export function promptFingerprint(): string {
  return createHash("sha256").update(systemPrompt()).digest("hex").slice(0, 12);
}

export const ReviewFindingShape = z.object({
  quote: z
    .string()
    .describe("The exact span from the section, copied character for character."),
  category: z.enum(["UNSUPPORTED", "OFF_TOPIC"]),
  whyUk: z.string().describe("One sentence in Ukrainian, addressed to the writer."),
  suggestionUk: z
    .string()
    .nullable()
    .describe("A concrete replacement, or null. Always null for UNSUPPORTED."),
});

export const ReviewShape = z.object({
  findings: z.array(ReviewFindingShape),
});
export type Review = z.infer<typeof ReviewShape>;

export function userPrompt(input: {
  org: OrganizationProfile;
  grant: Grant;
  sectionKey: string;
  content: string;
  donorText: string;
}): string {
  const def = sectionDefinition(input.sectionKey);

  return [
    "# Конкурс",
    `${input.grant.titleUk ?? input.grant.title} — ${input.grant.donorName}.`,
    ...(input.grant.eligibility.length > 0
      ? ["Умови:", ...input.grant.eligibility.map((r) => `— ${r.textUk ?? r.text}`)]
      : []),
    "",
    ...(input.donorText.trim().length > 0
      ? [
          "# Документи донора (початок)",
          input.donorText.slice(0, MAX_REVIEWER_DONOR_CHARS),
          "",
        ]
      : []),
    "# Профіль організації",
    // Answered facts only. The reviewer's job is to check a claim against what
    // the profile says; a list of what it does not say is the absence of
    // support, which is already the default.
    renderProfileText(input.org, { includeUnanswered: false }),
    "",
    `# Секція: ${def?.labelUk ?? input.sectionKey}`,
    `Питання, на яке вона має відповідати: ${def?.promptUk ?? "—"}`,
    "",
    "## Текст секції",
    input.content,
    "",
    "Знайдіть твердження без підтвердження та те, що не відповідає на питання секції.",
  ].join("\n");
}

export type ReviewRun = {
  findings: Finding[];
  /** Spans the model returned that are not in the section. Counted, not shown. */
  dropped: number;
  usage: Usage;
  promptFingerprint: string;
  error: string | null;
};

export async function reviewSection(
  input: {
    org: OrganizationProfile;
    grant: Grant;
    sectionKey: string;
    content: string;
    donorText?: string;
  },
  opts: CompleteOptions = {},
): Promise<ReviewRun> {
  // Reasoning off. Someone is waiting on this — it runs when a section opens —
  // and D7's finding holds: on recall over supplied text, thinking makes the
  // model infer what the source does not say, which for a reviewer means
  // inventing problems rather than finding them.
  const options: CompleteOptions = { think: false, ...opts };

  const completion = await complete(
    systemPrompt(),
    userPrompt({ ...input, donorText: input.donorText ?? "" }),
    ReviewShape,
    options,
  );

  const base = { usage: completion.usage, promptFingerprint: promptFingerprint() };

  if (!completion.parsed) {
    return {
      ...base,
      findings: [],
      dropped: 0,
      error: completion.error ?? "no output",
    };
  }

  const claimed: Finding[] = completion.parsed.findings.map((f) => ({
    quote: f.quote,
    category: f.category,
    whyUk: f.whyUk,
    // Two reasons a suggestion becomes null, both enforced rather than trusted.
    // An unsupported claim never gets a replacement — a model that writes one
    // supplies exactly the invented fact it is reporting. And prose that only
    // says there is nothing to suggest: asked for a replacement it has none for,
    // the model writes «Ні», which renders as advice to do nothing.
    suggestionUk:
      f.category === "UNSUPPORTED" || isEmptySetProse(f.suggestionUk)
        ? null
        : f.suggestionUk,
    source: "AI" as const,
  }));

  const inScope = claimed.filter(
    (f) => f.category !== "UNSUPPORTED" || keepsUnsupported(input.sectionKey, f.quote),
  );
  const verified = verifiedFindings(inScope, input.content);

  return {
    ...base,
    findings: verified.slice(0, MAX_FINDINGS),
    dropped: inScope.length - verified.length,
    error: null,
  };
}
