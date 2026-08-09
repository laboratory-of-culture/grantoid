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
import { MatchResult, MatchResultShape } from "../../packages/schemas/match";
import type { Grant } from "../../packages/schemas/grant";
import type { OrganizationProfile } from "../../packages/schemas/organization";

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

export type EligibilityRun = {
  result: MatchResult | null;
  usage: Usage;
  promptFingerprint: string;
  error: string | null;
  raw: string;
};

export async function assess(
  org: OrganizationProfile,
  grant: Grant,
  opts: CompleteOptions = {},
): Promise<EligibilityRun> {
  // The shape schema constrains decoding; the semantic schema runs after and
  // rejects a verdict that reached past its evidence. See agent-authoring.
  const completion = await complete(
    systemPrompt(),
    userPrompt(org, grant),
    MatchResultShape,
    opts,
  );

  if (completion.parsed === null) {
    return {
      result: null,
      usage: completion.usage,
      promptFingerprint: promptFingerprint(),
      error: completion.error ?? "no output",
      raw: completion.raw,
    };
  }

  const semantic = MatchResult.safeParse(completion.parsed);

  return {
    result: semantic.success ? semantic.data : null,
    usage: completion.usage,
    promptFingerprint: promptFingerprint(),
    error: semantic.success
      ? null
      : `semantic validation failed: ${semantic.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
    raw: completion.raw,
  };
}
