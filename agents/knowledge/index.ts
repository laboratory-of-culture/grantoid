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
  // Same reasoning as the eligibility agent: the judgement that matters here is
  // "does the document actually say this", and reasoning materially improves it.
  const options: CompleteOptions = { think: true, ...opts };

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
 * Keep only facts whose quotation is actually in the document.
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
    if (quoteAppearsIn(fact.quote, text)) {
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
