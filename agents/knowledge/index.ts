/**
 * The Organization Knowledge agent.
 *
 * Reads one document, returns the facts it settles, each with the sentence it
 * was read from. Every quote is then checked against the document text, and a
 * fact whose quote is not there is discarded — that check is the difference
 * between a knowledge base and a pile of plausible sentences.
 *
 * Tool allowlist is empty, and deliberately so: the input is a file somebody
 * uploaded, which is the most likely place in this product for an instruction
 * aimed at a model to arrive. An agent with no tools cannot act on one.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { complete, type CompleteOptions, type Usage } from "../../packages/llm/ollama";
import { FACT_REGISTRY } from "../../packages/schemas/fact-registry";
import { quoteAppearsIn } from "../../packages/schemas/match";
import { Extraction, ExtractionShape } from "./output";

export const TOOLS: readonly string[] = [];

const PROMPT_PATH = path.join(process.cwd(), "agents", "knowledge", "prompt.md");

export function systemPrompt(): string {
  return readFileSync(PROMPT_PATH, "utf8");
}

export function promptFingerprint(): string {
  return createHash("sha256").update(systemPrompt()).digest("hex").slice(0, 12);
}

/** The registry, as the agent needs to see it: key, what it means, what settles it. */
function registryForPrompt(): string {
  return FACT_REGISTRY.filter((d) => d.documentEvidencePossible)
    .map((d) => `- ${d.key} — ${d.labelUk}. ${d.questionUk}`)
    .join("\n");
}

export type Discarded = {
  key: string;
  quote: string;
  reason: string;
};

export type ExtractionRun = {
  facts: Extraction["facts"];
  documentSummary: string;
  unreadable: boolean;
  /** Facts dropped because their quotation is not in the document. */
  discarded: Discarded[];
  usage: Usage;
  promptFingerprint: string;
  error: string | null;
};

export function userPrompt(filename: string, kind: string, text: string): string {
  return [
    "# Fact registry",
    "",
    registryForPrompt(),
    "",
    "# Document",
    "",
    `filename: ${filename}`,
    `kind: ${kind}`,
    "",
    // Delimited, in a user turn, never spliced into the system prompt. The
    // fence is what makes "this is data" structurally true rather than asserted.
    "<<<DOCUMENT>>>",
    text,
    "<<<END DOCUMENT>>>",
    "",
    "Extract the facts this document settles about the organization.",
  ].join("\n");
}

export async function extract(
  filename: string,
  kind: string,
  text: string,
  opts: CompleteOptions = {},
): Promise<ExtractionRun> {
  /**
   * Reasoning off, unlike the eligibility agent.
   *
   * The first version copied `think: true` across from eligibility by
   * inertia, and the tasks are not alike: eligibility is a judgement, where
   * reasoning bought a measurable 80% → 88% on the golden set; extraction is
   * mechanical — find the sentence, copy it — and `model-runtime` classifies it
   * as high-volume, low-judgement work.
   *
   * It cost 258s on a 1.3KB statute, which does not survive a real 30KB one.
   * The honest measurement of what reasoning is worth here comes from the
   * end-to-end loop, not from a flag flipped in isolation, so this stays off
   * until upload → extract → confirm → match runs and shows where quality
   * actually sags.
   */
  const options: CompleteOptions = { think: false, ...opts };

  const completion = await complete(
    systemPrompt(),
    userPrompt(filename, kind, text),
    ExtractionShape,
    options,
  );

  const empty = {
    facts: [],
    documentSummary: "",
    unreadable: false,
    discarded: [],
    usage: completion.usage,
    promptFingerprint: promptFingerprint(),
  };

  if (completion.parsed === null) {
    return { ...empty, error: completion.error ?? "no output" };
  }

  const semantic = Extraction.safeParse(completion.parsed);
  if (!semantic.success) {
    return {
      ...empty,
      error: `semantic validation failed: ${semantic.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    };
  }

  const { kept, discarded } = filterToVerbatim(semantic.data.facts, text);

  return {
    facts: kept,
    documentSummary: semantic.data.documentSummary,
    unreadable: semantic.data.unreadable,
    discarded,
    usage: completion.usage,
    promptFingerprint: promptFingerprint(),
    error: null,
  };
}

/**
 * A value that says "the document does not answer this".
 *
 * The prompt tells the model to return nothing for a fact the document does not
 * settle, and on a statute qwen3:4b mostly does. On the terse registration
 * extract it does not: asked for a budget the document has no line for, it
 * emits `annual_budget_uah = «не вказано»` and cites the nearest sentence it can
 * find — the address. The quotation is real, so `quoteAppearsIn` passes it, and
 * the reviewer's queue fills with non-answers each carrying an unrelated quote.
 * An unanswered fact is already a stored UNKNOWN (D4); a candidate for it is
 * noise at best and a mismatched citation at worst.
 */
const NON_ANSWER = new Set([
  "не вказано",
  "не зазначено",
  "не визначено",
  "не встановлено",
  "невідомо",
  "немає інформації",
  "немає даних",
  "відсутня інформація",
  "відсутні дані",
  "інформація відсутня",
  "н/д",
  "n/a",
  "-",
  "—",
]);

function isNonAnswer(valueText: string): boolean {
  return NON_ANSWER.has(valueText.trim().toLowerCase().replace(/[.\s]+$/, ""));
}

/**
 * Keep only facts whose quotation is actually in the document and whose value
 * is an actual answer.
 *
 * The check the whole agent turns on, and pure so it can be tested without a
 * model. A fluent, plausible sentence the document never contained is exactly
 * what a language model produces under pressure, and it is indistinguishable
 * from a real quote by eye — which is why a person reviewing the confirmation
 * queue cannot be the first line of defence here.
 */
export function filterToVerbatim(
  facts: Extraction["facts"],
  text: string,
): { kept: Extraction["facts"]; discarded: Discarded[] } {
  const kept: Extraction["facts"] = [];
  const discarded: Discarded[] = [];

  for (const fact of facts) {
    if (isNonAnswer(fact.valueText)) {
      discarded.push({
        key: fact.key,
        quote: fact.quote,
        reason: "value is a non-answer — the document does not settle this fact",
      });
    } else if (quoteAppearsIn(fact.quote, text)) {
      kept.push(fact);
    } else {
      discarded.push({
        key: fact.key,
        quote: fact.quote,
        reason: "quotation does not appear in the document",
      });
    }
  }

  return { kept, discarded };
}
