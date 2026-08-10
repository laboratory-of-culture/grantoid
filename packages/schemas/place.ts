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
