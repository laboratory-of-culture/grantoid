/**
 * Formatting Ukrainian administrative names for display.
 *
 * The profile screen used to render `{org.oblast} область`, which is correct
 * only when the stored value is the bare adjective. It is not always: the value
 * arrives from three places that disagree — a person typing into the profile
 * form, a fact extracted from a statute, and the geography a grant states — and
 * "Чернівецька область" stored in full then renders as "Чернівецька область
 * область".
 *
 * The worse case is Kyiv and Sevastopol, which are cities with special status
 * and not oblasts at all. "м. Київ область" is not a typo an NGO in Kyiv would
 * find reassuring in a product that claims to read documents carefully.
 */

/**
 * Cities with special status under Article 133 of the Constitution. They are
 * administrative units on a par with oblasts, so they belong in the same field,
 * but the word "область" must never be appended to them.
 */
const SPECIAL_STATUS = [/^м\.?\s*київ/iu, /^київ$/iu, /^м\.?\s*севастопол/iu, /^севастополь$/iu];

/** The Autonomous Republic of Crimea, likewise not an oblast. */
const NOT_AN_OBLAST = [/автономна\s+республіка/iu, /^ар\s+крим/iu, /^крим$/iu];

/**
 * Render an oblast value as a label.
 *
 * Appends "область" only when the value is a bare adjective that does not
 * already carry it and is not one of the units that has no such word.
 */
export function formatOblast(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if ([...SPECIAL_STATUS, ...NOT_AN_OBLAST].some((p) => p.test(trimmed))) {
    return trimmed;
  }

  // Already carries the word, in any case and in any of its forms.
  //
  // The boundaries are `(?<!\p{L})` / `(?!\p{L})`, not `\b`. JavaScript defines
  // `\b` in terms of `\w`, which is `[A-Za-z0-9_]` and contains no Cyrillic at
  // all, so `/\bобласт/` never matches a Ukrainian string. This is the second
  // time that has bitten this codebase; see classify-rules.ts for the first.
  if (/(?<!\p{L})обла(сть|сті|стю|сная)(?!\p{L})/iu.test(trimmed)) return trimmed;

  return `${trimmed} область`;
}

/**
 * Ukrainian administrative units, keyed by the Latin spellings they come back as.
 *
 * A closed set, which is the whole reason this is a lookup and not a guess.
 * There are twenty-four oblasts, two cities with special status and one
 * autonomous republic; nothing else can appear here, so a table covers the
 * space completely and never has to infer.
 *
 * It exists because the extraction prompt asking for Ukrainian did not survive
 * contact with a 4B model. A live announcement that said «Дніпропетровська,
 * Запорізька, Миколаївська, Одеська» came back as `Dnipropetrovsk`,
 * `Zaporizhzhia`, `Mykolaiv`, `Odesa` — and kept coming back that way after the
 * prompt was made explicit. That is D5 for the sixth time: the prompt states
 * the rule, the code enforces it.
 *
 * The cost is not cosmetic. Matching compares a call's geography against the
 * organization's own, in Ukrainian, and refuses to compare across alphabets —
 * so a transliterated oblast neither matches nor excludes anybody. The record
 * reads as complete and behaves as empty.
 *
 * Keys are lower-cased and stripped of the words that decorate them, so one
 * entry covers `Odesa`, `Odesa Oblast` and `odeska`.
 */
const OBLAST_BY_LATIN: Record<string, string> = {
  vinnytsia: "Вінницька",
  volyn: "Волинська",
  dnipropetrovsk: "Дніпропетровська",
  dnipro: "Дніпропетровська",
  donetsk: "Донецька",
  zhytomyr: "Житомирська",
  zakarpattia: "Закарпатська",
  zaporizhzhia: "Запорізька",
  zaporizhia: "Запорізька",
  "ivano-frankivsk": "Івано-Франківська",
  kyiv: "Київська",
  kirovohrad: "Кіровоградська",
  luhansk: "Луганська",
  lviv: "Львівська",
  mykolaiv: "Миколаївська",
  odesa: "Одеська",
  odessa: "Одеська",
  poltava: "Полтавська",
  rivne: "Рівненська",
  sumy: "Сумська",
  ternopil: "Тернопільська",
  kharkiv: "Харківська",
  kherson: "Херсонська",
  khmelnytskyi: "Хмельницька",
  khmelnytsky: "Хмельницька",
  cherkasy: "Черкаська",
  chernivtsi: "Чернівецька",
  chernihiv: "Чернігівська",
};

/** Words that decorate a place name without identifying it. */
const OBLAST_NOISE = /\b(oblast|region|province|area|city of)\b/gi;

/**
 * Turn a transliterated Ukrainian oblast back into its Ukrainian name.
 *
 * Returns the input untouched when it is not one of the known units — including
 * when it is already Cyrillic, and including foreign place names like
 * `Creative Europe countries`, which are genuinely not Ukrainian oblasts and
 * must not be forced into the table.
 *
 * `Kyiv` maps to the oblast rather than the city. The two are different units
 * and the announcement rarely distinguishes them, so the wider one is chosen:
 * an organization in the city is inside the oblast for every purpose this
 * product uses geography for, and the reverse mistake would exclude people.
 */
export function ukrainianOblast(value: string): string {
  if (/\p{Script=Cyrillic}/u.test(value)) return value;

  const key = value
    .replace(OBLAST_NOISE, " ")
    .replace(/[^\p{L}\s-]/gu, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  const named = OBLAST_BY_LATIN[key];
  return named ? `${named} область` : value;
}
