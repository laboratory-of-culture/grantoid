/**
 * The grant extraction agent.
 *
 * Reads one announcement page and returns what it says. Two things are done to
 * its output rather than asked of it, because a model is a poor judge of both:
 *
 *   - **Quotes are verified against the source.** A rule whose quote does not
 *     occur in the text is dropped. This is the same check the organization
 *     knowledge extractor applies to documents, and for the same reason: a
 *     citation nobody verified is a citation that can be fabricated.
 *   - **Confidence is computed, not reported.** See `extractionConfidence`.
 *
 * Empty tool allowlist: the input is a page copied off a third party's website.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { complete, type CompleteOptions, type Usage } from "../../packages/llm/ollama";
import { ExtractedGrant, ExtractedGrantShape } from "./output";

export const TOOLS: readonly string[] = [];

const PROMPT_PATH = path.join(process.cwd(), "agents", "extraction", "prompt.md");

export function systemPrompt(): string {
  return readFileSync(PROMPT_PATH, "utf8");
}

export function promptFingerprint(): string {
  return createHash("sha256").update(systemPrompt()).digest("hex").slice(0, 12);
}

/** Whitespace and quote marks vary between the page and what a model copies. */
function normalizeForComparison(text: string): string {
  return text
    .replace(/[«»"'`‘’“”]/g, "")
    .replace(/[–—-]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function quoteOccursIn(quote: string, source: string): boolean {
  const needle = normalizeForComparison(quote);
  // Too short to be evidence of anything; "так" occurs in every page.
  if (needle.length < 12) return false;
  return normalizeForComparison(source).includes(needle);
}

/**
 * Fields that decide whether an organization can apply.
 *
 * Weighted rather than counted: a call with a deadline and no sector list is far
 * more usable than a call with a sector list and no deadline.
 */
const DECISIVE: { get: (g: ExtractedGrant) => boolean; weight: number; missingUk: string }[] = [
  { get: (g) => g.deadline !== null, weight: 3, missingUk: "кінцевий термін не вказано" },
  { get: (g) => g.eligibility.length > 0, weight: 3, missingUk: "умови прийнятності не описані" },
  { get: (g) => g.fundingMax !== null, weight: 2, missingUk: "розмір гранту не вказано" },
  { get: (g) => g.applicantTypes.length > 0, weight: 2, missingUk: "коло заявників не окреслено" },
  { get: (g) => g.sectors.length > 0, weight: 1, missingUk: "сфери не вказані" },
  { get: (g) => g.applicantGeography.length > 0, weight: 1, missingUk: "географія не вказана" },
  {
    get: (g) => g.cofinancingRequired !== null,
    weight: 1,
    missingUk: "вимога співфінансування не описана",
  },
  { get: (g) => g.donorName !== null, weight: 1, missingUk: "донора не названо" },
];

/**
 * The ceiling for anything read from an aggregator announcement.
 *
 * An announcement is a notice pointing at the donor's own call. Even a notice
 * that fills every field has not been checked against the donor's guidelines,
 * and the guidelines are where the disqualifying clause usually is. Nothing read
 * this way is allowed to look certain.
 */
export const ANNOUNCEMENT_CEILING = 0.75;

/**
 * How complete this record is, computed from what came back.
 *
 * Deliberately not asked of the model. A model rating its own output produces a
 * number that tracks its fluency rather than its coverage, and the one thing
 * this score has to do is fall when fields are missing.
 */
export function extractionConfidence(grant: ExtractedGrant, truncated: boolean): number {
  const total = DECISIVE.reduce((sum, f) => sum + f.weight, 0);
  const have = DECISIVE.filter((f) => f.get(grant)).reduce((sum, f) => sum + f.weight, 0);

  const coverage = have / total;
  // The ceiling scales the score rather than clipping it. Clipping made a grant
  // with no eligibility rules at all score the same 75% as a complete one, which
  // is precisely the distinction this number exists to carry.
  // A page that was cut short may be missing fields that were actually there,
  // which is a different and worse kind of incomplete.
  return coverage * ANNOUNCEMENT_CEILING * (truncated ? 0.8 : 1);
}

/** What was not read, in the words shown to an organization. */
export function missingFields(grant: ExtractedGrant): string[] {
  return DECISIVE.filter((f) => !f.get(grant)).map((f) => f.missingUk);
}

const MONTHS_UK = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня",
];

/**
 * Coerce whatever date form the model produced into `YYYY-MM-DD`, or null.
 *
 * Asking for ISO in the prompt gets ISO most of the time; the rest of the time
 * it gets "15 вересня 2026" or "15.09.2026", and the first live run threw away
 * two otherwise complete grants over exactly that. Reading the forms Ukrainian
 * announcements actually use is cheaper than losing the record.
 *
 * A date with no year is null rather than assumed. Assuming the current year is
 * how a call that closed last March becomes one that closes next March.
 */
export function normalizeDate(raw: string | null): string | null {
  if (raw === null) return null;
  const text = raw.trim().toLowerCase();
  if (text.length === 0) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const numeric = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(text);
  if (numeric) {
    const [, d, m, y] = numeric as unknown as [string, string, string, string];
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const named = new RegExp(`^(\\d{1,2})\\s+(${MONTHS_UK.join("|")})\\s+(\\d{4})`).exec(text);
  if (named) {
    const [, d, month, y] = named as unknown as [string, string, string, string];
    const m = String(MONTHS_UK.indexOf(month) + 1).padStart(2, "0");
    return `${y}-${m}-${d.padStart(2, "0")}`;
  }

  return null;
}

/**
 * Does the page actually contain this date?
 *
 * A date is the one field where a wrong answer is worse than none: an
 * organization that trusts an invented deadline misses the real one. The first
 * live run produced a deadline equal to the day the extraction ran, on a page
 * whose own summary said the term was not stated — so a date now has to be found
 * in the text before it is stored.
 *
 * Matches the forms Ukrainian announcements actually use: "10 серпня", "10.08",
 * "10/08" and the ISO form.
 */
export function dateOccursIn(iso: string, source: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;

  const [, year, month, day] = match as unknown as [string, string, string, string];
  const dayNum = String(Number(day));
  const monthName = MONTHS_UK[Number(month) - 1];
  const haystack = source.toLowerCase().replace(/ /g, " ");

  const forms = [
    iso,
    `${dayNum}.${month}`,
    `${day}.${month}`,
    `${dayNum}/${month}`,
    `${day}/${month}`,
    `${dayNum}.${month}.${year}`,
    `${day}.${month}.${year}`,
  ];
  if (monthName) {
    forms.push(`${dayNum} ${monthName}`, `${day} ${monthName}`);
  }

  return forms.some((form) => haystack.includes(form.toLowerCase()));
}

/**
 * Does the page contain this sum?
 *
 * Amounts are written with spaces, non-breaking spaces and apostrophes as group
 * separators, so the comparison is made on digits alone.
 */
export function amountOccursIn(amount: number, source: string): boolean {
  const digits = String(Math.round(amount));
  if (digits.length < 3) return false;
  const flattened = source.replace(/[\s '’]/g, "");
  return flattened.includes(digits);
}

export type ExtractionRun = {
  result: ExtractedGrant | null;
  /** Rules dropped because their quote was not in the page. */
  droppedRules: { text: string; quote: string }[];
  confidence: number;
  notes: string[];
  usage: Usage;
  promptFingerprint: string;
  error: string | null;
};

export function userPrompt(article: string, url: string, headline: string): string {
  return [
    `# Announcement page`,
    `URL: ${url}`,
    `Headline as listed: ${headline}`,
    "",
    "<<<PAGE>>>",
    article,
    "<<<END PAGE>>>",
    "",
    "Record what this announcement states. Leave null what it does not.",
  ].join("\n");
}

/**
 * Where the text came from, because the closing note differs.
 *
 * An announcement is a notice pointing at guidelines nobody has read, and every
 * record from one carries that caveat. A donor document *is* the guidelines —
 * printing «умови донора не читалися» under a record extracted from the donor's
 * own PDF is the product contradicting itself in the one place it is supposed
 * to be careful.
 */
export type ExtractionSource = "announcement" | "donor-document";

export async function extractGrant(
  article: string,
  url: string,
  headline: string,
  truncated = false,
  origin: ExtractionSource = "announcement",
  opts: CompleteOptions = {},
): Promise<ExtractionRun> {
  // Reasoning off, per D7: the organization knowledge extractor was measured at
  // twelve times faster *and* more accurate without it, because extraction is
  // recall over a text rather than a judgement, and thinking makes the model
  // infer what the document does not say. That failure mode is the exact one
  // this agent must not have.
  const options: CompleteOptions = { think: false, ...opts };

  const completion = await complete(
    systemPrompt(),
    userPrompt(article, url, headline),
    ExtractedGrantShape,
    options,
  );

  const base = {
    usage: completion.usage,
    promptFingerprint: promptFingerprint(),
  };

  if (!completion.parsed) {
    return {
      ...base,
      result: null,
      droppedRules: [],
      confidence: 0,
      notes: [],
      error: completion.error ?? "no output",
    };
  }

  const validated = ExtractedGrant.safeParse(completion.parsed);
  if (!validated.success) {
    return {
      ...base,
      result: null,
      droppedRules: [],
      confidence: 0,
      notes: [],
      error: validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }

  const grant = validated.data;
  const corrections: string[] = [];

  // Every rule must be traceable to a sentence that is actually on the page.
  const kept = grant.eligibility.filter((r) => quoteOccursIn(r.quote, article));
  const droppedRules = grant.eligibility
    .filter((r) => !quoteOccursIn(r.quote, article))
    .map((r) => ({ text: r.text, quote: r.quote }));

  // A date or a sum that is not on the page is discarded rather than stored.
  // Both are acted on directly by an organization, and being wrong about them
  // costs more than admitting they were not found.
  let deadline = normalizeDate(grant.deadline);
  if (grant.deadline !== null && deadline === null) {
    corrections.push(`дату «${grant.deadline}» не вдалося розпізнати`);
  }
  if (deadline !== null && !dateOccursIn(deadline, article)) {
    corrections.push(`дату ${deadline} відкинуто — її немає в тексті оголошення`);
    deadline = null;
  }

  let fundingMax = grant.fundingMax;
  let fundingMin = grant.fundingMin;
  if (fundingMax !== null && !amountOccursIn(fundingMax, article)) {
    corrections.push(`суму ${fundingMax} відкинуто — її немає в тексті оголошення`);
    fundingMax = null;
    fundingMin = null;
  }

  const result: ExtractedGrant = {
    ...grant,
    eligibility: kept,
    deadline,
    fundingMax,
    fundingMin,
  };

  // The model's own list is kept only for what no field covers. It was echoing
  // the phrasing of fields it had actually filled in, producing records that
  // contradicted themselves, so anything matching a computed note is dropped.
  const computed = new Set(DECISIVE.map((f) => f.missingUk));
  const fromModel = result.notReadFromSource.filter((note) => !computed.has(note.trim()));

  const notes = [
    ...new Set([
      ...missingFields(result),
      ...corrections,
      ...fromModel,
      ...(truncated
        ? [
            origin === "donor-document"
              ? "документ довший за те, що вміщає модель — прочитано лише початок"
              : "сторінку обрізано — прочитано не весь текст",
          ]
        : []),
      ...(droppedRules.length > 0
        ? [`${droppedRules.length} правил відкинуто: цитати не знайдено на сторінці`]
        : []),
      origin === "donor-document"
        ? "прочитано документ донора; звіряйте з оригіналом перед подачею"
        : "умови донора (PDF/сайт) не читалися — перевірте оригінал оголошення",
    ]),
  ];

  return {
    ...base,
    result,
    droppedRules,
    confidence: extractionConfidence(result, truncated),
    notes,
    error: null,
  };
}
