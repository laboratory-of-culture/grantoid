/**
 * What can be found in a draft without asking a model.
 *
 * The review runs rules first for the same reason classification does: if the
 * work is deterministic, it is code. Empty superlatives and forty-word sentences
 * are decidable by looking, and spending eighty seconds of a 4B model on them
 * would be slower, less reliable, and impossible to explain when it gets one
 * wrong.
 *
 * The hard constraint on everything here is **noise**. A reviewer that flags
 * something in every sentence gets switched off in a week, and then the findings
 * that mattered go unread along with the rest. So each pattern below has to
 * clear a single bar: would a grant manager, reading the flag, agree it was
 * worth interrupting them? Anything that only *might* be a problem is left to a
 * person.
 */

import { z } from "zod";

export const FindingCategory = z.enum([
  /** A claim nothing in the profile, the call or the donor documents supports. */
  "UNSUPPORTED",
  /** Says nothing measurable. «значне покращення ситуації» */
  "VAGUE",
  /** Sells rather than describes. «інноваційний», «унікальний» */
  "MARKETING",
  /** Does not answer the question this section exists to answer. */
  "OFF_TOPIC",
  /** Long enough that a reviewer loses the thread. */
  "LONG_SENTENCE",
]);
export type FindingCategory = z.infer<typeof FindingCategory>;

export const CATEGORY_LABEL_UK: Record<FindingCategory, string> = {
  UNSUPPORTED: "Немає підтвердження",
  VAGUE: "Розмито",
  MARKETING: "Рекламна мова",
  OFF_TOPIC: "Не про це",
  LONG_SENTENCE: "Задовге речення",
};

export type Finding = {
  /** The exact span, copied from the section. Verified before it is shown. */
  quote: string;
  category: FindingCategory;
  /** One sentence. Why this is worth changing, not what the category means. */
  whyUk: string;
  /**
   * A concrete replacement, or null when only the author can supply one.
   *
   * Null is not a failure. For an unsupported claim the honest suggestion is
   * "put the real figure here", and inventing a replacement would be the exact
   * defect being reported.
   */
  suggestionUk: string | null;
  source: "RULE" | "AI";
};

/**
 * Words that sell instead of describing.
 *
 * Every one of these is a word a reviewer at a foundation has read ten thousand
 * times and stopped seeing. They are flagged not because they are wrong but
 * because they occupy the space where a specific claim would have gone.
 *
 * Matched with `(?!\p{L})`-style stems rather than `\b`: JavaScript defines `\b`
 * through `\w`, which holds no Cyrillic, so the obvious version never fires. See
 * classify-rules.ts, place.ts and the eligibility agent — this is the fourth
 * time, and by now it is a property of the language, not an accident.
 */
const MARKETING: { stem: RegExp; whyUk: string; instead: string }[] = [
  {
    stem: /іннова(ційн|тивн)\p{L}*/giu,
    whyUk: "«Інноваційний» не описує нічого конкретного — донор читає це слово в кожній третій заявці.",
    instead: "Напишіть, що саме робиться вперше або інакше, ніж роблять зазвичай.",
  },
  {
    stem: /унікальн\p{L}*/giu,
    whyUk: "«Унікальний» — це твердження про весь ринок, яке ніхто не перевіряв.",
    instead: "Назвіть конкретну відмінність від того, що вже існує.",
  },
  {
    stem: /(найкращ|найефективніш|найсучасніш)\p{L}*/giu,
    whyUk: "Найвищий ступінь — це порівняння, якого у заявці немає.",
    instead: "Приберіть або замініть на те, з чим саме порівнюєте.",
  },
  {
    stem: /революційн\p{L}*/giu,
    whyUk: "Слово обіцяє масштаб, якого проєкт такого розміру не має.",
    instead: "Опишіть реальну зміну, яку проєкт справді дає.",
  },
  {
    stem: /потужн(ий|а|е|і|ого|ої)\s+(інструмент|платформ|рішенн)\p{L}*/giu,
    whyUk: "Це формулювання з презентації, а не з проєктної заявки.",
    instead: "Скажіть, що інструмент робить.",
  },
];

/**
 * Phrases that pass for content and carry none.
 *
 * Narrower than it could be, deliberately. «Покращення» on its own is a normal
 * word; «значне покращення ситуації» is three words that commit to nothing, and
 * only the second is worth interrupting someone over.
 */
const VAGUE: { pattern: RegExp; whyUk: string; instead: string }[] = [
  {
    pattern: /(значн\p{L}*|суттєв\p{L}*|істотн\p{L}*)\s+(покращенн|поліпшенн|зростанн|підвищенн)\p{L}*/giu,
    whyUk: "Наскільки значне? Без числа або орієнтира це речення нічого не стверджує.",
    instead: "Додайте, від чого і до чого, або приберіть прикметник.",
  },
  {
    pattern: /покращенн\p{L}*\s+(ситуації|становища|стану)(?!\p{L})/giu,
    whyUk: "«Покращення ситуації» описує будь-який проєкт у будь-якій сфері.",
    instead: "Назвіть, що конкретно зміниться і в кого.",
  },
  {
    // Stems on both halves. The first version matched only «низка заходів» and
    // missed «низку заходів» — the accusative, which is the form the phrase
    // actually appears in. Nominative-only patterns are the second way Ukrainian
    // morphology defeats a naive regex, after `\b`.
    pattern: /(?<!\p{L})(низк\p{L}*|ряд(?!\p{L}*(ок|к))\p{L}*)\s+(заход|активност|ініціатив)\p{L}*/giu,
    whyUk: "«Низка заходів» — це спосіб не називати заходи.",
    instead: "Перелічіть їх: три-чотири пункти читаються краще за узагальнення.",
  },
  {
    pattern: /комплексн\p{L}*\s+(підхід|рішенн|захід)\p{L}*/giu,
    whyUk: "«Комплексний підхід» не відрізняє цей проєкт від жодного іншого.",
    instead: "Опишіть складові, якщо їх справді кілька.",
  },
];

/**
 * Where a sentence stops being read.
 *
 * Forty words is generous — most style guides say twenty-five. Set high because
 * a reviewer flagging every second sentence is a reviewer nobody keeps on, and
 * because Ukrainian carries subordination more comfortably than English does.
 */
export const MAX_SENTENCE_WORDS = 40;

/** Split on sentence enders, keeping the sentence itself intact for quoting. */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function countWords(sentence: string): number {
  return sentence.split(/\s+/u).filter((w) => /\p{L}/u.test(w)).length;
}

/**
 * Everything findable without a model.
 *
 * Each finding quotes the exact span so the screen can highlight it, and so the
 * same verification that guards a citation guards a suggestion: a quote that is
 * not in the text is dropped rather than shown.
 */
export function ruleFindings(text: string): Finding[] {
  const found: Finding[] = [];
  const seen = new Set<string>();

  const push = (finding: Finding) => {
    const key = `${finding.category}:${finding.quote.toLowerCase()}`;
    // The same empty word twice in one section is one problem, not two.
    if (seen.has(key)) return;
    seen.add(key);
    found.push(finding);
  };

  for (const rule of MARKETING) {
    for (const match of text.matchAll(rule.stem)) {
      push({
        quote: match[0],
        category: "MARKETING",
        whyUk: rule.whyUk,
        suggestionUk: rule.instead,
        source: "RULE",
      });
    }
  }

  for (const rule of VAGUE) {
    for (const match of text.matchAll(rule.pattern)) {
      push({
        quote: match[0],
        category: "VAGUE",
        whyUk: rule.whyUk,
        suggestionUk: rule.instead,
        source: "RULE",
      });
    }
  }

  for (const sentence of sentences(text)) {
    const words = countWords(sentence);
    if (words <= MAX_SENTENCE_WORDS) continue;
    push({
      quote: sentence,
      category: "LONG_SENTENCE",
      whyUk: `${words} слів в одному реченні — рецензент втрачає думку десь посередині.`,
      // No replacement: splitting a sentence well requires knowing which half
      // matters, and that is a judgement about the project.
      suggestionUk: null,
      source: "RULE",
    });
  }

  return found;
}

/**
 * Drop findings whose span is not in the text.
 *
 * Applies to rule findings too, not only to the model's. A rule cannot really
 * fabricate a span, but running both through one gate means the screen has a
 * single guarantee to rely on — every highlight it draws exists — rather than
 * two guarantees with different provenance.
 */
export function verifiedFindings(findings: readonly Finding[], text: string): Finding[] {
  return findings.filter((f) => {
    const quote = f.quote.trim();
    // Shorter than this and a highlight lands on a fragment of a word.
    if (quote.length < 3) return false;
    return text.includes(quote);
  });
}

/** Where each finding sits, for highlighting. Non-overlapping, in order. */
export type Span = { start: number; end: number; finding: Finding };

/**
 * Resolve findings to positions.
 *
 * Overlaps are dropped rather than nested: two highlights over the same words
 * cannot both be clicked, and the longer span is kept because it carries more
 * context — a forty-word sentence flagged for length is more useful whole than
 * with one adjective inside it separately underlined.
 */
export function spansFor(findings: readonly Finding[], text: string): Span[] {
  const candidates: Span[] = [];

  for (const finding of findings) {
    const start = text.indexOf(finding.quote);
    if (start === -1) continue;
    candidates.push({ start, end: start + finding.quote.length, finding });
  }

  candidates.sort((a, b) => b.end - b.start - (a.end - a.start));

  const kept: Span[] = [];
  for (const candidate of candidates) {
    if (kept.some((k) => candidate.start < k.end && k.start < candidate.end)) continue;
    kept.push(candidate);
  }

  return kept.sort((a, b) => a.start - b.start);
}
