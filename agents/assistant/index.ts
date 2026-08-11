/**
 * The editor assistant.
 *
 * Revises one section on instruction. It proposes; it never writes. The result
 * is handed back to the screen for a person to accept or discard, and accepting
 * is what moves the section out of `AI_DRAFT` — an assistant that saved
 * directly would quietly undo the one distinction the editor is built on.
 *
 * Empty tool allowlist: it reads a profile, a call, a donor PDF somebody
 * uploaded and a free-text instruction. The uploaded document is the reason —
 * it is the least trusted input in the product, and a tool would give an
 * instruction hidden inside it somewhere to go.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import { complete, type CompleteOptions, type Usage } from "../../packages/llm/ollama";
import { sectionDefinition } from "../../packages/schemas/concept";
import { renderProfileText } from "../../packages/schemas/profile-text";
import type { Grant } from "../../packages/schemas/grant";
import type { OrganizationProfile } from "../../packages/schemas/organization";

export const TOOLS: readonly string[] = [];

const PROMPT_PATH = path.join(process.cwd(), "agents", "assistant", "prompt.md");

/** Longer than this and it is not an instruction, it is pasted content. */
export const MAX_INSTRUCTION_CHARS = 500;

export function systemPrompt(): string {
  return readFileSync(PROMPT_PATH, "utf8");
}

export function promptFingerprint(): string {
  return createHash("sha256").update(systemPrompt()).digest("hex").slice(0, 12);
}

export const SuggestionShape = z.object({
  content: z.string().describe("The whole revised section, in Ukrainian."),
  changeNoteUk: z
    .string()
    .describe("One or two sentences on what actually changed. Specific, not 'покращив текст'."),
});
export type Suggestion = z.infer<typeof SuggestionShape>;

export function userPrompt(input: {
  org: OrganizationProfile;
  grant: Grant;
  sectionKey: string;
  current: string;
  instruction: string;
  donorText: string;
  edited: boolean;
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
      ? ["# Документи донора", input.donorText, ""]
      : []),
    "# Профіль організації",
    renderProfileText(input.org),
    "",
    `# Секція: ${def?.labelUk ?? input.sectionKey}`,
    `Питання, на яке вона відповідає: ${def?.promptUk ?? "—"}`,
    input.edited
      ? "Цю секцію вже редагувала людина. Її формулювання — рішення, а не чернетка."
      : "Цю секцію написала модель, людина її ще не редагувала.",
    "",
    "## Поточний текст",
    input.current,
    "",
    "## Що просить зробити людина",
    input.instruction,
  ].join("\n");
}

export type AssistRun = {
  suggestion: Suggestion | null;
  usage: Usage;
  promptFingerprint: string;
  error: string | null;
};

export async function suggestRevision(
  input: {
    org: OrganizationProfile;
    grant: Grant;
    sectionKey: string;
    current: string;
    instruction: string;
    donorText?: string;
    edited?: boolean;
  },
  opts: CompleteOptions = {},
): Promise<AssistRun> {
  // Reasoning off, as with the generator: this is rewriting supplied material to
  // an instruction, and D7 measured thinking on that shape of task as both
  // slower and more prone to inferring what the source did not say. It also has
  // to feel interactive — a person is waiting on this one, unlike the feed.
  const options: CompleteOptions = { think: false, ...opts };

  const completion = await complete(
    systemPrompt(),
    userPrompt({
      ...input,
      donorText: input.donorText ?? "",
      edited: input.edited ?? false,
    }),
    SuggestionShape,
    options,
  );

  const base = { usage: completion.usage, promptFingerprint: promptFingerprint() };

  if (!completion.parsed || completion.parsed.content.trim().length === 0) {
    return {
      ...base,
      suggestion: null,
      error: completion.error ?? "модель не повернула тексту",
    };
  }

  return { ...base, suggestion: completion.parsed, error: null };
}
