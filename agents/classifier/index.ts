/**
 * The classifier agent.
 *
 * Reached only for items no rule settles — see `packages/ingestion/classify-rules.ts`.
 * ГУРТ marks its own headlines, so most of its items never get here; Громадський
 * Простір marks nothing, so most of its items do.
 *
 * Empty tool allowlist: the input is a title and summary copied off a third
 * party's website, which is untrusted text by definition.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import { complete, type CompleteOptions, type Usage } from "../../packages/llm/ollama";

export const TOOLS: readonly string[] = [];

const PROMPT_PATH = path.join(process.cwd(), "agents", "classifier", "prompt.md");

export function systemPrompt(): string {
  return readFileSync(PROMPT_PATH, "utf8");
}

export function promptFingerprint(): string {
  return createHash("sha256").update(systemPrompt()).digest("hex").slice(0, 12);
}

export const ClassificationShape = z.object({
  isGrant: z
    .boolean()
    .describe("True only if an organization could apply and receive funding for its own project."),
  category: z
    .enum(["GRANT", "PROCUREMENT", "VACANCY", "TRAINING", "DIGEST", "RESULTS", "OTHER"])
    .describe("What the announcement actually is."),
  confidence: z.number().describe("0 to 1."),
  reason: z.string().describe("One sentence in Ukrainian that an operator can check."),
});
export type Classification = z.infer<typeof ClassificationShape>;

/**
 * Below this, the item is left for a person rather than filed automatically.
 *
 * Both mistakes cost, and they cost differently: a wrongly accepted item wastes
 * an NGO's time in its feed, a wrongly rejected one never reaches anyone. Only a
 * confident answer decides on its own.
 */
export const CONFIDENCE_FLOOR = 0.7;

export type ClassificationRun = {
  result: Classification | null;
  usage: Usage;
  promptFingerprint: string;
  error: string | null;
};

export function userPrompt(title: string, summary: string | null, sourceName: string): string {
  return [
    `# Announcement from ${sourceName}`,
    "",
    "<<<ITEM>>>",
    `Заголовок: ${title}`,
    summary ? `Опис: ${summary}` : "Опис: (відсутній)",
    "<<<END ITEM>>>",
    "",
    "Is this a funding call an NGO could apply to?",
  ].join("\n");
}

export async function classify(
  title: string,
  summary: string | null,
  sourceName: string,
  opts: CompleteOptions = {},
): Promise<ClassificationRun> {
  // Reasoning off: this is a short, near-mechanical judgement over two lines of
  // text, and D7 measured that reasoning on mechanical work costs an order of
  // magnitude in latency while making the model editorialise.
  const options: CompleteOptions = { think: false, ...opts };

  const completion = await complete(
    systemPrompt(),
    userPrompt(title, summary, sourceName),
    ClassificationShape,
    options,
  );

  return {
    result: completion.parsed,
    usage: completion.usage,
    promptFingerprint: promptFingerprint(),
    error: completion.error,
  };
}
