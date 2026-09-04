/**
 * Ukrainian counts and dates, in one place.
 *
 * Both rules come from `ua-locale`, and both exist to prevent the same
 * four-second judgement: a grant manager who sees «1 умов конкурсу» or a date as
 * `08/10/2026` concludes the product was built for someone else, and no amount
 * of good matching recovers that.
 *
 * `Intl` rather than hand-rolled arithmetic or a literal format, because the
 * arithmetic is easy to get subtly wrong (11–14 are the trap) and every place
 * that rolls its own gets a slightly different answer.
 */

const RULES = new Intl.PluralRules("uk");

/**
 * The three forms, in the order `Intl.PluralRules` names them.
 *
 * one — 1, 21, 31 …    «1 умова»
 * few — 2–4, 22–24 …   «3 умови»
 * many — 0, 5–20, …    «5 умов»
 */
export type PluralFormsUk = { one: string; few: string; many: string };

export function pluralUk(n: number, forms: PluralFormsUk): string {
  switch (RULES.select(n)) {
    case "one":
      return forms.one;
    case "few":
      return forms.few;
    default:
      // `other` covers fractions as well as `many`. A fraction cannot reach any
      // caller here — these all count rows — and the genitive plural is the
      // form Ukrainian uses for it anyway.
      return forms.many;
  }
}

/** The count and its noun, together — what a caller almost always wants. */
export function countUk(n: number, forms: PluralFormsUk): string {
  return `${n} ${pluralUk(n, forms)}`;
}

/**
 * A date as a Ukrainian reader expects it: `10 серпня 2026`.
 *
 * Never the numeric short form. `20.08.2026` and `08/10/2026` are both ambiguous
 * between conventions this audience uses, and the one place that matters most is
 * a deadline — the field where reading the month as the day costs an
 * application.
 */
const DATE = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatDateUk(date: Date): string {
  return DATE.format(date);
}

/**
 * The genitive month names Ukrainian dates use: «15 березня 2019».
 *
 * Duplicated from the extraction agent's copy on purpose — that one is reverse
 * geocoding a model's free text against an announcement and is covered by the
 * eval, this one parses what a person or the knowledge agent put in a profile
 * field. Coupling them would make one set of tests gate the other.
 */
const MONTHS_UK_GENITIVE = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];

/**
 * Coerce a date a person or the knowledge agent wrote into `YYYY-MM-DD`.
 *
 * A registration date reaches storage three ways: typed into `<input type=date>`
 * (already ISO), corrected by hand in the confirm queue (a free-text field), or
 * lifted verbatim from a statute by the knowledge agent — and a statute writes
 * «зареєстровано 15 березня 2019 року» or «"15" березня 2019 р.», never ISO.
 * Stored as-is, that string then renders as an empty date picker the next time
 * someone opens the field to edit it, because the control only speaks ISO.
 *
 * Returns null when there is no unambiguous date to be had (no year, a month
 * name it does not recognise) rather than guessing — the caller rejects the
 * value and asks for `YYYY-MM-DD`.
 */
export function normalizeDateUk(raw: string | null | undefined): string | null {
  const text = raw?.trim().toLowerCase().replace(/[«»"'']/g, "").replace(/\s+/g, " ");
  if (!text) return null;

  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) {
    const [, y, m, d] = iso as unknown as [string, string, string, string];
    return isoIfReal(y, m, d);
  }

  const numeric = /(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(text);
  if (numeric) {
    const [, d, m, y] = numeric as unknown as [string, string, string, string];
    return isoIfReal(y, m, d);
  }

  const named = new RegExp(`(\\d{1,2})\\s+(${MONTHS_UK_GENITIVE.join("|")})\\s+(\\d{4})`).exec(text);
  if (named) {
    const [, d, month, y] = named as unknown as [string, string, string, string];
    return isoIfReal(y, String(MONTHS_UK_GENITIVE.indexOf(month) + 1), d);
  }

  return null;
}

function isoIfReal(year: string, month: string, day: string): string | null {
  const m = month.padStart(2, "0");
  const d = day.padStart(2, "0");
  const iso = `${year}-${m}-${d}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  // Rejects 2019-02-30 and 2019-13-01. Reading the components back rather than
  // trusting `Invalid Date` alone, because the two ways in here disagree: the
  // ISO form makes V8 reject an impossible day outright, while a day assembled
  // from «31 лютого 2019» could otherwise roll over into March.
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() + 1 !== Number(m) ||
    parsed.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return iso;
}

/**
 * A stored `YYYY-MM-DD` fact value, shown the way the rest of the UI shows dates.
 *
 * Built as a *local* calendar date, never `…T00:00:00Z`. A registration date is
 * a day on a calendar, not an instant: parsed as UTC midnight and then formatted
 * in the reader's zone, it moves back a day for anyone west of Greenwich. That
 * is not hypothetical here — the app container runs in UTC and the confirm queue
 * is a client component, so the server would render «15 березня» into the HTML
 * and the browser would hydrate «14 березня» over it. Constructing the date in
 * local time makes every zone agree, which is what a calendar date has to do.
 *
 * Falls back to the raw string if it is somehow not ISO — a value that predates
 * normalisation should still be legible, not blanked.
 */
export function formatIsoDateUk(value: string): string {
  const trimmed = value.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!m) return trimmed;
  return formatDateUk(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** The nouns this product counts. Named once so two screens cannot disagree. */
export const NOUN_UK = {
  criterion: { one: "умова", few: "умови", many: "умов" },
  field: { one: "поле", few: "поля", many: "полів" },
  document: { one: "документ", few: "документи", many: "документів" },
  finding: { one: "зауваження", few: "зауваження", many: "зауважень" },
  draft: { one: "чернетка", few: "чернетки", many: "чернеток" },
  opportunity: { one: "можливість", few: "можливості", many: "можливостей" },
  section: { one: "секцію", few: "секції", many: "секцій" },
} as const satisfies Record<string, PluralFormsUk>;

/**
 * Does this text say "there is nothing here"?
 *
 * Asked for a list or a suggestion, a model answers in prose rather than
 * returning null: «Немає обов'язкових блокерів», «Ні», «Відсутні». Rendered as
 * content, each of those becomes an item that says there are no items — the
 * opposite of what it means.
 *
 * Shared because it has now been needed three times: the eligibility agent's
 * blockers, its open questions, and the reviewer's suggestions.
 *
 * Word boundaries here are negative lookaheads, never the usual escape:
 * JavaScript defines that one through ASCII word characters, which contain
 * no Cyrillic at all. Fourth time this has mattered in this codebase.
 */
const EMPTY_SET_PROSE_UK =
  /^\s*(немає|нема(?!\p{L})|ні(?!\p{L})|відсутн|не виявлено|не потрібно|жодн|none(?!\p{L})|no\s+(blockers|issues)|n\/?a|[-—–])/iu;

export function isEmptySetProse(text: string | null | undefined): boolean {
  const trimmed = text?.trim();
  if (!trimmed) return true;
  return EMPTY_SET_PROSE_UK.test(trimmed);
}

/**
 * Enum names the model drops into the middle of a Ukrainian sentence.
 *
 * Live output: «Вимога юридичної форми (MANDATORY) не виконується». Stripping a
 * leading slug and rejecting a bare enum caught neither, because this one sits
 * inside the sentence and the sentence is otherwise fine.
 *
 * A closed list rather than "any run of capitals": donor names are acronyms too,
 * and WPHF is four uppercase letters that belong on screen. The vocabulary this
 * system emits is known, so it is the thing to match.
 */
const ENUM_VOCABULARY = [
  "MANDATORY",
  "PREFERRED",
  "EXCLUDED",
  "MATCH",
  "LIKELY_MATCH",
  "UNCERTAIN",
  "LIKELY_NOT_ELIGIBLE",
  "NOT_ELIGIBLE",
  "NO_PROFILE_DATA",
  "AMBIGUOUS_CALL",
  "CONFLICTING_EVIDENCE",
  "UNKNOWN",
  "SELF_REPORTED",
  "CONFIRMED",
  "EXPLICIT_NEGATIVE",
].join("|");

/** In brackets, or standing alone between non-letters. */
const EMBEDDED_ENUM = new RegExp(
  String.raw`\s*[(\[]\s*(?:${ENUM_VOCABULARY})\s*[)\]]` +
    String.raw`|(?<![\p{L}_])(?:${ENUM_VOCABULARY})(?![\p{L}_])`,
  "gu",
);

export function stripEnums(text: string): string {
  return text
    .replace(EMBEDDED_ENUM, " ")
    .replace(/\s{2,}/g, " ")
    // The removal leaves a gap before the punctuation that followed it.
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}
