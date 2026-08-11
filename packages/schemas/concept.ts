/**
 * The sections a concept note is written in.
 *
 * Data rather than a union scattered across files, for the same reason as the
 * fact registry: three things have to stay in step — the generator (what to
 * write), the editor (what to show), and the assistant (what it is being asked
 * to improve).
 *
 * The order is the order a reviewer reads in, and it is also the order the
 * argument has to hold together in: a goal that does not answer the problem
 * above it is visible as soon as they sit next to each other.
 */

import { z } from "zod";

export const SectionSource = z.enum(["AI_DRAFT", "HUMAN_EDITED", "HUMAN"]);
export type SectionSource = z.infer<typeof SectionSource>;

export const DraftStatus = z.enum(["DRAFT", "REVIEWED"]);
export type DraftStatus = z.infer<typeof DraftStatus>;

export type SectionDefinition = {
  key: string;
  labelUk: string;
  /** What this section has to answer, in the words shown above the field. */
  promptUk: string;
  /** Guidance the generator is given. Not shown to the user. */
  guidance: string;
  /** Rough target, so a draft is not three words or three pages. */
  targetWords: number;
};

export const CONCEPT_SECTIONS: readonly SectionDefinition[] = [
  {
    key: "problem",
    labelUk: "Проблема",
    promptUk: "Яку проблему розв'язує проєкт і кого вона стосується?",
    guidance:
      "State the problem in the applicant's own region and for its own target group. " +
      "Concrete and local beats general and global. No statistics unless the profile or " +
      "the call supplies them — an invented number is worse than none.",
    targetWords: 120,
  },
  {
    key: "goal",
    labelUk: "Мета проєкту",
    promptUk: "Чого проєкт має досягти?",
    guidance:
      "One sentence naming the change, then one on scope. The goal must answer the " +
      "problem section directly — if it introduces a new subject, the concept does not " +
      "hold together.",
    targetWords: 70,
  },
  {
    key: "target_group",
    labelUk: "Цільова група",
    promptUk: "Хто отримає користь і скільки таких людей?",
    guidance:
      "Use the target groups from the organization profile and from the call. Give a " +
      "number only if one of them supports it; otherwise describe who, not how many.",
    targetWords: 80,
  },
  {
    key: "activities",
    labelUk: "Основні активності",
    promptUk: "Що саме робитиме організація?",
    guidance:
      "Three to six activities, each one something a person could put in a calendar. " +
      "Draw on what this organization already does — a concept proposing work it has " +
      "never done is the one a donor rejects.",
    targetWords: 160,
  },
  {
    key: "results",
    labelUk: "Очікувані результати",
    promptUk: "Що зміниться після завершення проєкту?",
    guidance:
      "Separate outputs from outcomes. Every result must trace to an activity above it.",
    targetWords: 120,
  },
  {
    key: "capacity",
    labelUk: "Спроможність організації",
    promptUk: "Чому саме ваша організація здатна це зробити?",
    guidance:
      "Only what the profile actually holds: team size, previous grants, partners, " +
      "confirmed experience. Do not claim capacity the profile does not record.",
    targetWords: 110,
  },
  {
    key: "sustainability",
    labelUk: "Сталість",
    promptUk: "Що житиме далі після закінчення фінансування?",
    guidance:
      "What continues without further money: materials, trained people, partnerships, " +
      "methods. Say plainly if only part of it continues.",
    targetWords: 90,
  },
  {
    key: "budget_outline",
    labelUk: "Орієнтовний бюджет",
    promptUk: "На що приблизно піде фінансування?",
    guidance:
      "Broad categories with rough shares, inside the call's ceiling if one is known. " +
      "No line items and no totals unless the call states a figure — a budget invented " +
      "to look precise is the most damaging thing on this page.",
    targetWords: 100,
  },
] as const;

export const SECTION_KEYS = CONCEPT_SECTIONS.map((s) => s.key);

const BY_KEY = new Map(CONCEPT_SECTIONS.map((s) => [s.key, s]));

export function sectionDefinition(key: string): SectionDefinition | undefined {
  return BY_KEY.get(key);
}

export const SectionKey = z.string().refine((k) => BY_KEY.has(k), {
  message: "unknown concept section — add it to CONCEPT_SECTIONS first",
});

export const SECTION_SOURCE_LABEL_UK: Record<SectionSource, string> = {
  AI_DRAFT: "Чернетка AI",
  HUMAN_EDITED: "Відредаговано вами",
  HUMAN: "Написано вами",
};

/**
 * Whether a draft may leave the product.
 *
 * `human-in-the-loop`: nothing a model wrote reaches a donor without a person
 * having read it. Untouched AI sections are what this checks for, and the
 * transition out of `AI_DRAFT` only happens when someone edits or approves.
 */
export function unreviewedSections(
  sections: readonly { key: string; source: SectionSource; approvedAt: Date | null }[],
): string[] {
  return sections
    .filter((s) => s.source === "AI_DRAFT" && s.approvedAt === null)
    .map((s) => s.key);
}
