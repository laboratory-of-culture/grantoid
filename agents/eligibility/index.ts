/**
 * The Eligibility agent.
 *
 * Reads one grant and one organization profile, returns a verdict per rule plus
 * an overall assessment. Built from `agents/_template`; the prompt lives in
 * `prompt.md` so an edit shows up as an isolated diff and the fingerprint
 * recorded with every eval result means something.
 *
 * Tool allowlist is empty. This agent reads two documents and returns a
 * judgement — it has no reason to fetch a URL, and giving it one would widen the
 * blast radius of an instruction carried inside an uploaded statute.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { complete, type CompleteOptions, type Usage } from "../../packages/llm/ollama";
import {
  permittedVerdicts,
  rollUp,
  shouldRecommend,
  type Assessed,
} from "../../packages/schemas/ladder";
import { MatchResult, MatchResultShape } from "../../packages/schemas/match";
import type { Grant } from "../../packages/schemas/grant";
import type { OrganizationProfile } from "../../packages/schemas/organization";
import type { Verdict } from "../../packages/schemas/verdict";

export const TOOLS: readonly string[] = [];

const PROMPT_PATH = path.join(process.cwd(), "agents", "eligibility", "prompt.md");

export function systemPrompt(): string {
  return readFileSync(PROMPT_PATH, "utf8");
}

/** Short stable hash of the prompt, recorded with every eval run. */
export function promptFingerprint(): string {
  return createHash("sha256").update(systemPrompt()).digest("hex").slice(0, 12);
}

/**
 * Render a fixture for the prompt, dropping empty collections.
 *
 * A profile field rendered as `[]` reads like a confirmed "none", which is
 * exactly the confusion the UNKNOWN fact state exists to prevent.
 */
function render(value: unknown): string {
  const pruned = JSON.parse(
    JSON.stringify(value, (_k, v) => {
      if (v === null || v === undefined) return undefined;
      if (Array.isArray(v) && v.length === 0) return undefined;
      return v;
    }),
  );
  return JSON.stringify(pruned, null, 2);
}

/**
 * Only the facts the model needs, in a shape that puts the state first.
 *
 * The full profile carries eighteen rows, most of them UNKNOWN and empty. Sent
 * verbatim they bury the handful that decide the verdict, and on a 4B model that
 * matters more than it would on a larger one.
 */
function renderProfile(org: OrganizationProfile): string {
  const facts = org.facts.map((f) => ({
    key: f.key,
    state: f.state,
    value: f.valueList ?? f.valueText ?? f.valueNumber ?? f.valueBoolean ?? undefined,
  }));

  return render({
    id: org.id,
    name: org.name,
    legalForm: org.legalForm,
    oblast: org.oblast,
    city: org.city,
    mission: org.mission,
    facts,
  });
}

function renderGrant(grant: Grant): string {
  return render({
    id: grant.id,
    title: grant.titleUk ?? grant.title,
    donor: grant.donorName,
    deadline: grant.deadlineIsKnown ? grant.deadline : "не вказано у джерелі",
    funding: grant.funding,
    sectors: grant.sectors,
    targetGroups: grant.targetGroups,
    applicantTypes: grant.applicantTypes,
    applicantGeography: grant.applicantGeography,
    eligibility: grant.eligibility.map((r) => ({
      key: r.key,
      kind: r.kind,
      text: r.textUk ?? r.text,
      resolvingFactKey: r.resolvingFactKey,
      grantQuote: r.citation?.quote,
    })),
    extractionConfidence: grant.extractionConfidence,
    extractionNotes: grant.extractionNotes,
  });
}

export function userPrompt(org: OrganizationProfile, grant: Grant): string {
  return [
    "# Grant",
    renderGrant(grant),
    "",
    "# Organization profile",
    renderProfile(org),
    "",
    "Assess this organization against this grant.",
  ].join("\n");
}

export type Correction = {
  ruleKey: string;
  from: Verdict;
  to: Verdict;
  reason: string;
};

export type EligibilityRun = {
  result: MatchResult | null;
  usage: Usage;
  promptFingerprint: string;
  error: string | null;
  raw: string;
  /** Verdicts the evidence did not support, and what they were replaced with. */
  corrections: Correction[];
};

/**
 * Constrain the model's verdicts to what the profile actually supports.
 *
 * The "unknown is not no" rule is stated in the prompt, and a 4B model does not
 * reliably follow it — the first eval run collapsed every UNCERTAIN pair, once
 * into MATCH and once into NOT_ELIGIBLE, on the same empty field.
 *
 * It does not need to follow it. Which profile fact resolves which rule is
 * recorded data, and the fact's state is known exactly. So the ladder's own
 * `permittedVerdicts` is applied here, after generation: a rule whose resolving
 * fact was never answered becomes UNCERTAIN whatever the model said, and a
 * rejection is only allowed to stand where the organization confirmed the
 * negative.
 *
 * Corrections are recorded rather than applied silently. A model that needs
 * correcting often is one to replace, and that is only visible if the count is.
 */
function applyEvidenceConstraints(
  result: MatchResult,
  org: OrganizationProfile,
  grant: Grant,
): { result: MatchResult; corrections: Correction[] } {
  const ruleByKey = new Map(grant.eligibility.map((r) => [r.key, r]));
  const factByKey = new Map(org.facts.map((f) => [f.key, f]));
  const corrections: Correction[] = [];

  const criteria = result.criteria.map((c) => {
    const rule = ruleByKey.get(c.ruleKey);
    const factKey = rule?.resolvingFactKey ?? null;
    // No single fact resolves this rule — it is judged from the profile as a
    // whole, where inference is legitimate. Leave it alone.
    if (!factKey) return c;

    const state = factByKey.get(factKey)?.state ?? "UNKNOWN";
    const allowed = permittedVerdicts(state);
    if (allowed.includes(c.verdict)) return c;

    const to: Verdict = state === "UNKNOWN" ? "UNCERTAIN" : "LIKELY_NOT_ELIGIBLE";
    corrections.push({
      ruleKey: c.ruleKey,
      from: c.verdict,
      to,
      reason:
        state === "UNKNOWN"
          ? `"${factKey}" has never been answered, so this rule can only be UNCERTAIN`
          : `"${factKey}" is ${state}; only EXPLICIT_NEGATIVE supports NOT_ELIGIBLE`,
    });

    return {
      ...c,
      verdict: to,
      uncertaintyReason: to === "UNCERTAIN" ? ("NO_PROFILE_DATA" as const) : null,
      missingInformation:
        to === "UNCERTAIN"
          ? (c.missingInformation ?? `Потрібна відповідь на питання профілю: ${factKey}.`)
          : c.missingInformation,
    };
  });

  if (corrections.length === 0) return { result, corrections };

  // The overall verdict is derived, so it has to be recomputed from the
  // corrected criteria rather than left as the model wrote it.
  const assessed: Assessed[] = criteria.map((c) => {
    const rule = ruleByKey.get(c.ruleKey);
    const factKey = rule?.resolvingFactKey ?? null;
    return {
      ruleKey: c.ruleKey,
      kind: rule?.kind ?? "MANDATORY",
      verdict: c.verdict,
      uncertaintyReason: c.uncertaintyReason,
      resolvingFactState: factKey ? (factByKey.get(factKey)?.state ?? "UNKNOWN") : null,
    };
  });

  const overall = rollUp(assessed);

  return {
    result: {
      ...result,
      criteria,
      overall,
      recommend: shouldRecommend(assessed, result.matchScore),
    },
    corrections,
  };
}

/**
 * Reasoning is on by default for this agent, and only this agent.
 *
 * Measured on the golden set with qwen3:4b: thinking off collapses half the
 * UNCERTAIN pairs even with the evidence constraints applied; thinking on
 * collapses none, and per-criterion agreement goes 80% → 88%. It costs about
 * 3.3× the latency, which is affordable here because matching is queue work
 * against a feed, not something a person waits on.
 *
 * Set `think: false` explicitly to measure the difference again after a model
 * change — see docs/DECISIONS.md D6.
 */
export async function assess(
  org: OrganizationProfile,
  grant: Grant,
  opts: CompleteOptions = {},
): Promise<EligibilityRun> {
  const options: CompleteOptions = { think: true, ...opts };
  // The shape schema constrains decoding; the semantic schema runs after and
  // rejects a verdict that reached past its evidence. See agent-authoring.
  const completion = await complete(
    systemPrompt(),
    userPrompt(org, grant),
    MatchResultShape,
    options,
  );

  if (completion.parsed === null) {
    return {
      result: null,
      usage: completion.usage,
      promptFingerprint: promptFingerprint(),
      error: completion.error ?? "no output",
      raw: completion.raw,
      corrections: [],
    };
  }

  const semantic = MatchResult.safeParse(completion.parsed);
  if (!semantic.success) {
    return {
      result: null,
      usage: completion.usage,
      promptFingerprint: promptFingerprint(),
      error: `semantic validation failed: ${semantic.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
      raw: completion.raw,
      corrections: [],
    };
  }

  const constrained = applyEvidenceConstraints(semantic.data, org, grant);

  return {
    result: constrained.result,
    usage: completion.usage,
    promptFingerprint: promptFingerprint(),
    error: null,
    raw: completion.raw,
    corrections: constrained.corrections,
  };
}
