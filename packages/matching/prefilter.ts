/**
 * What never reaches the eligibility agent.
 *
 * The agent costs 82 seconds per organization × grant pair, measured on
 * `qwen3:4b` with reasoning on — and reasoning is what took unknown-collapse
 * from 50% to 0% (D6), so it is not negotiable. One organization against a
 * hundred grants is therefore 2.3 hours, and a feed built by calling the model
 * on every pair does not exist.
 *
 * This is the gate. Pure functions over stored fields, no model, no database.
 *
 * Two rules govern every decision here:
 *
 *   1. **`UNKNOWN` passes through.** An unanswered profile question is not a
 *      reason to hide an opportunity. D4 says absence cannot produce a
 *      rejection, and a filter that quietly drops grants an organization never
 *      got to see is a rejection with no verdict attached to argue with.
 *
 *   2. **Every exclusion carries its reason, in Ukrainian.** Otherwise the feed
 *      acquires a second ranking that nobody can inspect — which is exactly the
 *      thing `explainable-output` exists to prevent, moved one layer down where
 *      it is harder to notice.
 *
 * The asymmetry is deliberate. Excluding a grant an organization could have won
 * is expensive and invisible; passing through one that turns out ineligible
 * costs a single model call. So each rule fires only on positive evidence of a
 * mismatch, never on the absence of evidence of a match.
 */

/** Words too common to carry meaning in an overlap test. */
const STOPWORDS = new Set([
  "та",
  "і",
  "й",
  "в",
  "у",
  "на",
  "для",
  "з",
  "із",
  "до",
  "the",
  "and",
  "for",
  "of",
]);

/**
 * Ukrainian is inflected, so "культура", "культури" and "культурний" are the
 * same term for this purpose and string equality finds none of them. Comparing
 * a fixed-length prefix is crude and it is enough: the endings carry the case,
 * the stem carries the meaning.
 *
 * Words shorter than four characters are dropped rather than stemmed — "ЗМІ"
 * and "мир" would match half the corpus on a three-character prefix.
 */
const STEM_LENGTH = 5;
const MIN_WORD = 4;

export function stems(
  values: readonly string[],
  noise: ReadonlySet<string> = new Set(),
): Set<string> {
  const out = new Set<string>();
  for (const value of values) {
    for (const word of value.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (word.length < MIN_WORD || STOPWORDS.has(word)) continue;
      const stem = word.slice(0, STEM_LENGTH);
      if (noise.has(stem)) continue;
      out.add(stem);
    }
  }
  return out;
}

export function overlaps(
  a: readonly string[],
  b: readonly string[],
  noise: ReadonlySet<string> = new Set(),
): boolean {
  const left = stems(a, noise);
  for (const stem of stems(b, noise)) if (left.has(stem)) return true;
  return false;
}

/**
 * Administrative nouns, which every place name carries and none of them is
 * distinguished by.
 *
 * Stored as stems, since that is what the comparison works on. Without this,
 * "Чернівецька область" and "Донецька область" overlap on «облас» and the
 * geography rule never excludes anything — which is how the tests found it.
 *
 * Scoped to geography rather than added to STOPWORDS: "громада" is noise in a
 * place name and meaningful in a sector list ("розвиток громад").
 */
const GEO_NOISE: ReadonlySet<string> = new Set([
  "облас", // область, області, обласний
  "район", // район, районі
  "грома", // громада, громади
  "місто",
  "міста",
  "селищ",
  "терит", // територія, територіальний
  "regio",
  "oblas",
]);

/**
 * Geography that covers any Ukrainian organization.
 *
 * Most calls state their reach as "Україна" or leave it open; a rule that
 * compared oblast names literally would exclude every organization from every
 * nationwide call, which is the most expensive mistake this module can make.
 */
const NATIONWIDE =
  /(україн|ukrain|усі\s+област|вся\s+країн|по\s+всій\s+терит|nationwide|all\s+regions|global|worldwide|міжнародн|international|будь-як)/iu;

/**
 * Longest a value can be and still be a place name.
 *
 * The first live run excluded a call whose stated geography was "Країни, що
 * мають офіційний мирний процес (Track 1 або 2)…" — a description of
 * eligibility, not a list of regions. Compared as a place name it matches
 * nothing and rejects everyone, which is the most expensive mistake this module
 * can make.
 */
const MAX_PLACE_NAME = 40;

function looksLikePlaceList(values: readonly string[]): boolean {
  return values.length > 0 && values.every((v) => v.trim().length <= MAX_PLACE_NAME);
}

/** The same guard for sector labels, which extraction fills just as loosely. */
function looksLikeLabelList(values: readonly string[]): boolean {
  return values.length > 0 && values.every((v) => v.trim().length <= MAX_PLACE_NAME);
}

export type FilterableOrganization = {
  /** Null when the profile fact is UNKNOWN — not an empty list. */
  sectors: readonly string[] | null;
  geography: readonly string[] | null;
  /** Ukrainian label, e.g. "Громадська організація (ГО)". Null when unknown. */
  legalForm: string | null;
  oblast: string | null;
};

export type FilterableGrant = {
  id: string;
  sectors: readonly string[];
  applicantGeography: readonly string[];
  applicantTypes: readonly string[];
  deadline: Date | null;
  deadlineIsKnown: boolean;
  status: "OPEN" | "CLOSED" | "UPCOMING" | "UNKNOWN";
};

export type PrefilterVerdict =
  | { pass: true; skipped: string[] }
  | { pass: false; rule: string; reasonUk: string };

/**
 * A closed call.
 *
 * The only hard exclusion in this module, and the only one that needs no
 * judgement: a deadline that has passed is a fact, not an inference. An unknown
 * deadline passes — extraction routinely fails to find one, and "we could not
 * read the date" must never present as "you are too late".
 */
export function deadlinePassed(grant: FilterableGrant, now: Date): boolean {
  if (grant.status === "CLOSED") return true;
  if (!grant.deadlineIsKnown || grant.deadline === null) return false;
  return grant.deadline.getTime() < now.getTime();
}

/**
 * Does the applicant's geography rule this organization out?
 *
 * Only when the call names regions, none of them is nationwide, and the
 * organization's own stated geography shares nothing with them. Every one of
 * those conditions is required — drop any and the rule starts excluding on
 * silence.
 */
export function geographyExcludes(
  org: FilterableOrganization,
  grant: FilterableGrant,
): boolean {
  if (grant.applicantGeography.length === 0) return false;
  if (grant.applicantGeography.some((g) => NATIONWIDE.test(g))) return false;
  // A sentence describing who qualifies is not a region list, and comparing it
  // as one rejects everybody.
  if (!looksLikePlaceList(grant.applicantGeography)) return false;

  const orgPlaces = [
    ...(org.geography ?? []),
    ...(org.oblast ? [org.oblast] : []),
  ];
  // Nothing known about where the organization works: pass it through.
  if (orgPlaces.length === 0) return false;

  // If stripping the administrative nouns leaves the call with no place name at
  // all, there is nothing left to compare and nothing to exclude on.
  if (stems(grant.applicantGeography, GEO_NOISE).size === 0) return false;

  return !overlaps(orgPlaces, grant.applicantGeography, GEO_NOISE);
}

/**
 * Does the sector list rule this organization out?
 *
 * Same shape as geography, and the same caution. A call that lists no sectors
 * is open to all of them, and an organization that has not said what it does
 * cannot be excluded for doing the wrong thing.
 */
export function sectorExcludes(org: FilterableOrganization, grant: FilterableGrant): boolean {
  if (grant.sectors.length === 0) return false;
  if (org.sectors === null || org.sectors.length === 0) return false;

  // Extraction sometimes files an applicant description under sectors — the
  // live corpus produced "Місцеві жіночі правозахисні організації" as a sector.
  // Compared as a label it matches nothing and excludes everyone.
  if (!looksLikeLabelList(grant.sectors)) return false;

  // Comparing across scripts is comparing nothing: "Active Play" shares no stem
  // with "культура" no matter how related they are, and the exclusion that
  // follows is an artefact of language, not of fit. Both live over-exclusions
  // found on the first feed run were this. The model reads both languages, so
  // the pair goes to it.
  if (!sameScript(org.sectors, grant.sectors)) return false;

  return !overlaps(org.sectors, grant.sectors);
}

const CYRILLIC = /\p{Script=Cyrillic}/u;

/** Whether two label lists are written in the same alphabet at all. */
export function sameScript(a: readonly string[], b: readonly string[]): boolean {
  const aCyrillic = a.some((v) => CYRILLIC.test(v));
  const bCyrillic = b.some((v) => CYRILLIC.test(v));
  return aCyrillic === bCyrillic;
}

/**
 * Applicant type is deliberately *not* a filter.
 *
 * It is the field that most looks like one and is least usable as one. Calls
 * word it freely — "громадські організації", "неприбуткові організації",
 * "юридичні особи", "організації громадянського суспільства", "ОГС", "NGOs",
 * "civil society actors" — and several of those describe the same applicant. A
 * string test over that vocabulary excludes real matches, silently, in the one
 * dimension where the model actually earns its cost.
 *
 * Recorded here rather than omitted, so the next person does not add it as an
 * oversight.
 */
export const APPLICANT_TYPE_IS_NOT_FILTERED = true;

export function prefilter(
  org: FilterableOrganization,
  grant: FilterableGrant,
  now: Date = new Date(),
): PrefilterVerdict {
  if (deadlinePassed(grant, now)) {
    return {
      pass: false,
      rule: "deadline-passed",
      reasonUk: "термін подання минув",
    };
  }

  if (geographyExcludes(org, grant)) {
    return {
      pass: false,
      rule: "geography",
      reasonUk: `конкурс обмежений регіонами: ${grant.applicantGeography.join(", ")}`,
    };
  }

  if (sectorExcludes(org, grant)) {
    return {
      pass: false,
      rule: "sector",
      reasonUk: `сфери конкурсу не перетинаються з вашими: ${grant.sectors.join(", ")}`,
    };
  }

  // What the filter could not judge. Carried forward so the feed can say why a
  // pair was sent to the model rather than settled cheaply — and so a profile
  // with nothing filled in does not look like a profile that matched everything.
  const skipped: string[] = [];
  if (org.sectors === null || org.sectors.length === 0) {
    skipped.push("сфери організації не вказані");
  }
  if ((org.geography ?? []).length === 0 && !org.oblast) {
    skipped.push("географія організації не вказана");
  }
  if (!grant.deadlineIsKnown) {
    skipped.push("кінцевий термін конкурсу невідомий");
  }

  return { pass: true, skipped };
}

export type PrefilterSummary = {
  passed: FilterableGrant[];
  excluded: { grant: FilterableGrant; rule: string; reasonUk: string }[];
};

/** Apply the gate to a whole candidate set. */
export function prefilterAll(
  org: FilterableOrganization,
  grants: readonly FilterableGrant[],
  now: Date = new Date(),
): PrefilterSummary {
  const summary: PrefilterSummary = { passed: [], excluded: [] };

  for (const grant of grants) {
    const verdict = prefilter(org, grant, now);
    if (verdict.pass) summary.passed.push(grant);
    else summary.excluded.push({ grant, rule: verdict.rule, reasonUk: verdict.reasonUk });
  }

  return summary;
}
