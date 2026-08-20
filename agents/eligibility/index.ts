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
import { stripEnums } from "../../packages/schemas/locale-uk";
import { factSentence, renderProfileText } from "../../packages/schemas/profile-text";
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
  // Compact, not indented. Two-space indentation on a nested object is pure
  // whitespace tokens — measurable, and it buys nothing: the model is not
  // reading this for pleasure, and the structure survives without the padding.
  return JSON.stringify(pruned);
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
    renderProfileText(org),
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
 * Drop list entries that say the list is empty.
 *
 * A model asked for "blockers" will answer «Немає обов'язкових блокерів» rather
 * than return `[]`, and a one-element array containing that sentence renders on
 * the feed as though it were a blocker — the opposite of what it says. The empty
 * set has a representation already; prose describing it is not a second one.
 */
// `(?!\p{L})` and not `\b`: JavaScript defines `\b` through `\w`, which holds no
// Cyrillic, so `/нема\b/` never matches a Ukrainian string. Third time in this
// codebase — see classify-rules.ts and place.ts.
const EMPTY_SET_PROSE =
  /^\s*(немає|нема(?!\p{L})|відсутн|не виявлено|жодн|none(?!\p{L})|no\s+(blockers|issues)|n\/?a|[-—–])/iu;

/** A rule slug the model prefixed onto its own sentence: "geography: …". */
const LEADING_SLUG = /^\s*[a-z][a-z0-9-]{2,}\s*:\s*/;

/** An entry that is only an enum name — "NOT_ELIGIBLE" — and says nothing. */
const BARE_ENUM = /^[A-Z_]{4,}$/;

export function meaningfulEntries(values: readonly string[]): string[] {
  const out: string[] = [];

  for (const value of values) {
    // The slug is addressed to the system, not to a grant manager, and the
    // criterion breakdown already names the rule beside its quote.
    const text = stripEnums(value.replace(LEADING_SLUG, ""));
    if (text.length === 0) continue;
    if (BARE_ENUM.test(text)) continue;
    if (EMPTY_SET_PROSE.test(text)) continue;
    out.push(text);
  }

  return out;
}

function normalizeForComparison(text: string): string {
  return text
    .replace(/[«»"'`‘’“”]/g, "")
    .replace(/[–—-]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Is this quote actually in the profile it claims to come from?
 *
 * The same rule the extraction agent is held to, applied on the other side of
 * the product. Catching machine notation was not enough: a model can equally
 * produce a fluent, plausible Ukrainian sentence that the profile never said,
 * and that is the more dangerous of the two because nothing about it looks
 * wrong. An eligibility verdict whose profile citation cannot be found in the
 * profile is a fabrication, however well it reads.
 */
export function quoteIsInProfile(quote: string, renderedProfile: string): boolean {
  const needle = normalizeForComparison(quote);
  if (needle.length < 12) return false;
  return normalizeForComparison(renderedProfile).includes(needle);
}

/**
 * Does this "quote" look like the system talking to itself?
 *
 * Matches the notation the profile used to be rendered in — a fact key, a state
 * enum, sometimes a JSON array. Prose never looks like this, so a false positive
 * costs nothing and a false negative puts unverifiable text on screen under the
 * word «цитата».
 */
export function looksLikeMachineNotation(quote: string): boolean {
  return (
    /\b(UNKNOWN|SELF_REPORTED|CONFIRMED|EXPLICIT_NEGATIVE)\b/.test(quote) ||
    /^[a-z][a-z0-9_]{3,}\s*:/.test(quote.trim()) ||
    /\[['"]/.test(quote)
  );
}

/**
 * Strip fields that only mean something on an UNCERTAIN verdict.
 *
 * `uncertaintyReason` is a discriminator on UNCERTAIN, not a property of every
 * criterion, and the model does emit `MATCH` alongside `NO_PROFILE_DATA` — the
 * first live feed lost two matches to the database check that catches exactly
 * that pair. The constraint is right and stays; this is the layer that should
 * have made it unreachable.
 *
 * Normalised rather than rejected. The verdict is what an organization acts on,
 * and discarding a whole assessment over a discriminator that should have been
 * null repeats the mistake extraction made with a malformed date. Verdicts are
 * never touched here — those changes go through the corrections list, where they
 * are counted.
 */
function coherent(c: MatchResult["criteria"][number]): MatchResult["criteria"][number] {
  if (c.verdict === "UNCERTAIN") return c;
  if (c.uncertaintyReason === null && c.missingInformation === null) return c;
  // "Немає" is what a model writes into a field it has nothing to put in; it
  // would render as «бракує: Немає» beside a criterion that is not missing
  // anything.
  return { ...c, uncertaintyReason: null, missingInformation: null };
}

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
  // The same text the model was given, so "is this quote in the profile" is
  // asked against exactly what it read.
  const profileText = renderProfileText(org);

  const criteria = result.criteria.map((raw) => {
    let c = coherent(raw);
    const rule = ruleByKey.get(c.ruleKey);
    const factKey = rule?.resolvingFactKey ?? null;

    // A profile quote is evidence only if it is in the profile. Two ways it can
    // fail: the system's own notation copied back, or a fluent sentence the
    // profile never said. The second is the dangerous one — nothing about it
    // looks wrong. Either way the sentence the profile *does* support is
    // substituted, because the evidence usually exists and only the wording was
    // invented; dropping it would turn a correct verdict into an UNCERTAIN.
    const unsupported =
      c.profileQuote !== null &&
      (looksLikeMachineNotation(c.profileQuote) || !quoteIsInProfile(c.profileQuote, profileText));

    if (unsupported) {
      const fact = factKey ? factByKey.get(factKey) : undefined;
      const supported = fact && fact.state !== "UNKNOWN" ? factSentence(fact) : null;
      c = { ...c, profileQuote: supported };
      if (c.profileQuote === null && c.verdict !== "UNCERTAIN") {
        // Nothing verifiable is left to stand on, and a definite verdict may not
        // rest on evidence a person cannot check.
        c = {
          ...c,
          verdict: "UNCERTAIN",
          uncertaintyReason: "CONFLICTING_EVIDENCE",
          missingInformation:
            c.missingInformation ?? "Не вдалося підтвердити цей висновок цитатою з профілю.",
        };
      }
    }

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

  // `criteria`, not `result.criteria` — the early return used to hand back the
  // model's original output, which threw away the coherence pass above in
  // exactly the case that needed it: a result with no verdict corrections at
  // all, carrying a stray reason on a MATCH.
  const tidied = {
    ...result,
    criteria,
    blockers: meaningfulEntries(result.blockers),
    openQuestions: meaningfulEntries(result.openQuestions),
  };

  if (corrections.length === 0) return { result: tidied, corrections };

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
      ...tidied,
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
