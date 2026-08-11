/**
 * The concept generator.
 *
 * Drafts a concept note for one organization against one call. Everything it
 * writes is a draft: `human-in-the-loop` says nothing a model wrote reaches a
 * donor without a person having read it, and this agent's output is stored as
 * `AI_DRAFT` sections precisely so that rule has something to check.
 *
 * Empty tool allowlist. It reads two documents and writes prose; a tool would
 * only widen the blast radius of an instruction carried inside an uploaded
 * statute or a donor PDF.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import { complete, type CompleteOptions, type Usage } from "../../packages/llm/ollama";
import { CONCEPT_SECTIONS, type SectionDefinition } from "../../packages/schemas/concept";
import { renderProfileText } from "../../packages/schemas/profile-text";
import type { Grant } from "../../packages/schemas/grant";
import type { OrganizationProfile } from "../../packages/schemas/organization";

export const TOOLS: readonly string[] = [];

const PROMPT_PATH = path.join(process.cwd(), "agents", "concept", "prompt.md");

export function systemPrompt(): string {
  return readFileSync(PROMPT_PATH, "utf8");
}

export function promptFingerprint(): string {
  return createHash("sha256").update(systemPrompt()).digest("hex").slice(0, 12);
}

export const DraftedSection = z.object({
  key: z.string().describe("The section key you were asked for, exactly as given."),
  content: z.string().describe("The section text, in Ukrainian."),
});

export const ConceptDraftShape = z.object({
  titleUk: z
    .string()
    .describe("A working title for the project — specific, not the name of the call."),
  sections: z.array(DraftedSection),
});
export type ConceptDraftOutput = z.infer<typeof ConceptDraftShape>;

/**
 * The call, as the writer needs it rather than as the matcher needs it.
 *
 * Deliberately excludes the match verdict. A concept written to argue against an
 * eligibility finding is a concept that argues with the donor, and the writer's
 * job is to describe a project, not to litigate a score.
 */
function renderCall(grant: Grant): string {
  const funding =
    grant.funding.max !== null
      ? `Максимальна сума: ${grant.funding.max} ${grant.funding.currency ?? ""}.`
      : "Розмір гранту в оголошенні не вказано.";

  return [
    `Назва конкурсу: ${grant.titleUk ?? grant.title}.`,
    `Донор: ${grant.donorName}.`,
    grant.deadlineIsKnown && grant.deadline
      ? `Кінцевий термін: ${grant.deadline}.`
      : "Кінцевий термін в оголошенні не вказано.",
    funding,
    grant.sectors.length > 0 ? `Сфери конкурсу: ${grant.sectors.join("; ")}.` : null,
    grant.targetGroups.length > 0
      ? `Цільові групи конкурсу: ${grant.targetGroups.join("; ")}.`
      : null,
    grant.applicantGeography.length > 0
      ? `Географія: ${grant.applicantGeography.join("; ")}.`
      : null,
    "",
    "## Умови участі",
    ...(grant.eligibility.length > 0
      ? grant.eligibility.map(
          (r) =>
            `— [${r.kind === "PREFERRED" ? "перевага" : r.kind === "EXCLUDED" ? "виключення" : "вимога"}] ${r.textUk ?? r.text}`,
        )
      : ["Умови участі в оголошенні не описані."]),
    "",
    // The writer must know the terms are partial, or it will treat silence as
    // permission — the same failure the feed guards against, one stage later.
    `Прочитано з оголошення: ${Math.round(grant.extractionConfidence * 100)}%.` +
      (grant.extractionNotes
        ? ` Не прочитано: ${grant.extractionNotes.split("\n").join("; ")}.`
        : ""),
  ]
    .filter((l) => l !== null)
    .join("\n");
}

function renderSections(sections: readonly SectionDefinition[]): string {
  return sections
    .map((s) =>
      [
        `### ${s.key}`,
        `Питання: ${s.promptUk}`,
        `Настанова: ${s.guidance}`,
        `Орієнтовний обсяг: ${s.targetWords} слів.`,
      ].join("\n"),
    )
    .join("\n\n");
}

export function userPrompt(
  org: OrganizationProfile,
  grant: Grant,
  sections: readonly SectionDefinition[],
  donorText = "",
): string {
  return [
    "# Конкурс",
    renderCall(grant),
    "",
    // The donor's own guidelines, when the organization has supplied them. They
    // outrank the announcement: the announcement is a notice about the call and
    // this is the call. Placed after it so a contradiction is read in that
    // order.
    ...(donorText.trim().length > 0
      ? [
          "# Документи донора (завантажені організацією)",
          "Це повні умови конкурсу. Де вони суперечать оголошенню вище, правильні саме вони.",
          donorText,
          "",
        ]
      : []),
    "# Профіль організації",
    renderProfileText(org),
    "",
    "# Секції, які треба написати",
    renderSections(sections),
    "",
    `Напишіть ${sections.length} секцій: ${sections.map((s) => s.key).join(", ")}.`,
  ].join("\n");
}

export type ConceptRun = {
  result: ConceptDraftOutput | null;
  /** Keys asked for that came back empty or missing. */
  missingSections: string[];
  usage: Usage;
  promptFingerprint: string;
  error: string | null;
};

export async function generateConcept(
  org: OrganizationProfile,
  grant: Grant,
  keys: readonly string[] = CONCEPT_SECTIONS.map((s) => s.key),
  donorText = "",
  opts: CompleteOptions = {},
): Promise<ConceptRun> {
  const sections = CONCEPT_SECTIONS.filter((s) => keys.includes(s.key));

  // Reasoning off. This is composition from supplied material rather than a
  // judgement, which is the shape D7 measured as both faster and *better*
  // without it — thinking made the extractor infer what its source did not say,
  // and inventing what the inputs do not contain is the one failure this agent
  // cannot have. Worth re-measuring per section once there are drafts to judge.
  const options: CompleteOptions = { think: false, ...opts };

  const completion = await complete(
    systemPrompt(),
    userPrompt(org, grant, sections, donorText),
    ConceptDraftShape,
    options,
  );

  const base = { usage: completion.usage, promptFingerprint: promptFingerprint() };

  if (!completion.parsed) {
    return {
      ...base,
      result: null,
      missingSections: sections.map((s) => s.key),
      error: completion.error ?? "no output",
    };
  }

  // Only keys that were asked for. A model that invents a section key would
  // otherwise create a row the editor has no definition for and cannot label.
  const asked = new Set(sections.map((s) => s.key));
  const kept = completion.parsed.sections.filter(
    (s) => asked.has(s.key) && s.content.trim().length > 0,
  );
  const returned = new Set(kept.map((s) => s.key));

  return {
    ...base,
    result: { titleUk: completion.parsed.titleUk, sections: kept },
    missingSections: sections.map((s) => s.key).filter((k) => !returned.has(k)),
    error: null,
  };
}
