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
      "Name the cost categories this project needs, ordered from largest to smallest, " +
      "and say plainly that the split between them is for the applicant to decide. " +
      "**No percentages, no sums, no line items** — not even approximate ones, and not " +
      "even if they would add up. The first live draft invented 40/30/20/10 because " +
      "this guidance asked for 'rough shares', and a fabricated split is the most " +
      "damaging thing that can appear on this page: it looks like a decision somebody " +
      "made. Only a figure the call itself states may be repeated, as the ceiling.",
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
 * Numbers in a generated section that neither the profile nor the call supports.
 *
 * The prompt forbids inventing figures, and a 4B model does not reliably obey —
 * the first draft produced a budget split of 40/30/20/10, and the second, after
 * that was fixed, produced «1000 мешканців» out of nothing. This is the same
 * shape as D5: state the rule in the prompt, enforce it in code.
 *
 * Enforcement here is *flagging*, not rewriting. Surgically removing a number
 * from someone's prose leaves ungrammatical text and hides that anything
 * happened; naming it lets a grant manager replace it with the real figure,
 * which is the only person who knows it.
 *
 * Digits, plus magnitudes written as words *when they count people or money*.
 *
 * The narrow rule was deliberate: a guard that fires on rhetorical «тисячі
 * років спадщини» gets ignored within a week, and that phrase is not a claim.
 * Then a live draft opened with «у Чернівцях та Чернівецькій області, де
 * мешкають мільйони людей» — an oblast of about 890 000, stated as fact in the
 * first sentence a funder reads, and invisible to a check that only looked at
 * digits.
 *
 * So a magnitude word is flagged only when a noun for people or money follows
 * it closely. «Мільйони людей» is a claim; «тисячі років» is not.
 */
/**
 * A magnitude in words, followed closely by what it counts.
 *
 * Word boundaries as lookarounds, never the usual escape: JavaScript defines
 * that one through ASCII word characters, which contain no Cyrillic at all, so
 * it matches in the middle of every Ukrainian word. Fifth time in this codebase.
 */
const SPELLED_MAGNITUDE =
  /(?<!\p{L})(десятк\p{L}*|сотн\p{L}*|тисяч\p{L}*|мільйон\p{L}*|мільярд\p{L}*)(?!\p{L})(?:\s+\p{L}+){0,2}\s+(люд\p{L}*|осіб|особ\p{L}*|мешканц\p{L}*|учасник\p{L}*|гривен\p{L}*|грн|євро|долар\p{L}*)(?!\p{L})/giu;

export function unsupportedNumbers(text: string, sources: readonly string[]): string[] {
  const haystack = sources.join("\n").replace(/[\s '’ ]/g, "");
  const found = new Set<string>();

  for (const match of text.matchAll(SPELLED_MAGNITUDE)) {
    // The call or the profile may well say it — a donor writing «десятки тисяч
    // мешканців» in its own guidelines is a supported figure, not an invention.
    //
    // Compared by stem, because Ukrainian inflects both halves: the source says
    // «тисяч мешканців» and the draft says «тисячі мешканців», and a literal
    // comparison would call the second one invented. Five characters is the
    // same stem length the matching pre-filter settled on.
    const stem = (w: string) => w.toLowerCase().slice(0, 5);
    const magnitude = stem(match[1]!);
    const counted = stem(match[2]!);
    const supported = sources.some((src) => {
      const low = src.toLowerCase();
      return low.includes(magnitude) && low.includes(counted);
    });
    if (supported) continue;
    found.add(match[0].replace(/\s+/g, " ").trim());
  }

  // A percentage is always a claim, however short.
  //
  // The length rule below skips one- and two-digit numbers because they are
  // usually ordinals or list counts. A percentage never is: «зменшить втрати на
  // 20%», «кількість активних ветеранів збільшиться на 30%», «тренерів — на
  // 50%» all came out of live drafts, all promised measurable impact to a
  // funder, and all slipped through for being two digits long.
  for (const match of text.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)) {
    const whole = match[0].replace(/\s+/g, "");
    if (haystack.includes(whole) || haystack.includes(`${match[1]}%`)) continue;
    found.add(whole);
  }

  for (const match of text.matchAll(/\d[\d\s'’ ]*\d|\d/g)) {
    const digits = match[0].replace(/[\s'’ ]/g, "");
    // One- and two-digit numbers are usually ordinals, list counts or years in
    // a phrase like "14–25 років" that came from the call. Too noisy to flag —
    // except as a percentage, handled above.
    if (digits.length < 3) continue;
    if (haystack.includes(digits)) continue;
    found.add(digits);
  }

  return [...found];
}

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
