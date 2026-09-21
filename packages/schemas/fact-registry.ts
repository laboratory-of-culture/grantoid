/**
 * The fixed set of organization profile fields.
 *
 * This is data, not a union type scattered across files, because three things
 * need to read it and stay in step: onboarding (which questions to ask), the
 * knowledge-base extractor (which facts a document can settle), and the
 * eligibility agent (which fact resolves which rule).
 *
 * Adding a key here is what creates the UNKNOWN rows for every existing
 * organization — see the backfill note at the bottom.
 */

import { z } from "zod";

export const FactValueKind = z.enum(["TEXT", "BOOLEAN", "NUMBER", "LIST", "DATE"]);
export type FactValueKind = z.infer<typeof FactValueKind>;

export const FactGroup = z.enum([
  "IDENTITY", // Ідентифікація
  "LEGAL", // Правовий статус
  "ACTIVITY", // Діяльність
  "REACH", // Географія та аудиторії
  "CAPACITY", // Спроможність
  "EXPERIENCE", // Досвід
]);
export type FactGroup = z.infer<typeof FactGroup>;

export type FactDefinition = {
  /** Stable key. Referenced by eligibility rules; never rename in place. */
  key: string;
  group: FactGroup;
  kind: FactValueKind;
  /** The question as an NGO reads it, in Ukrainian. */
  questionUk: string;
  /** Short label for the profile screen. */
  labelUk: string;
  /**
   * Whether a document can settle this fact, or only a human can. A statute can
   * prove a legal form; nothing in an upload proves that a partnership is still
   * active.
   */
  documentEvidencePossible: boolean;
};

export const FACT_REGISTRY: readonly FactDefinition[] = [
  {
    key: "legal_form",
    group: "LEGAL",
    kind: "TEXT",
    labelUk: "Організаційно-правова форма",
    questionUk: "Яка організаційно-правова форма вашої організації?",
    documentEvidencePossible: true,
  },
  {
    key: "edrpou",
    group: "IDENTITY",
    kind: "TEXT",
    labelUk: "Код ЄДРПОУ",
    questionUk: "Який код ЄДРПОУ вашої організації?",
    documentEvidencePossible: true,
  },
  {
    key: "non_profit_status",
    group: "LEGAL",
    kind: "BOOLEAN",
    labelUk: "Неприбутковий статус",
    questionUk: "Чи внесена організація до Реєстру неприбуткових установ та організацій?",
    documentEvidencePossible: true,
  },
  {
    key: "registration_date",
    group: "LEGAL",
    kind: "DATE",
    labelUk: "Дата реєстрації",
    questionUk: "Коли організацію було зареєстровано?",
    documentEvidencePossible: true,
  },
  {
    key: "registration_oblast",
    group: "IDENTITY",
    kind: "TEXT",
    labelUk: "Область реєстрації",
    questionUk: "У якій області зареєстрована організація?",
    documentEvidencePossible: true,
  },
  {
    key: "activity_areas",
    group: "ACTIVITY",
    kind: "LIST",
    labelUk: "Напрями діяльності",
    questionUk: "У яких напрямах працює ваша організація?",
    documentEvidencePossible: true,
  },
  {
    key: "sectors",
    group: "ACTIVITY",
    kind: "LIST",
    labelUk: "Сфери",
    questionUk: "У яких сферах ви працюєте — культура, освіта, молодь, медіа, інше?",
    documentEvidencePossible: true,
  },
  {
    key: "is_publisher",
    group: "ACTIVITY",
    kind: "BOOLEAN",
    labelUk: "Видавнича діяльність",
    questionUk: "Чи веде організація видавничу діяльність?",
    documentEvidencePossible: false,
  },
  {
    key: "geographic_coverage",
    group: "REACH",
    kind: "LIST",
    labelUk: "Географія діяльності",
    questionUk: "У яких громадах або областях ви працюєте?",
    documentEvidencePossible: true,
  },
  {
    key: "target_audiences",
    group: "REACH",
    kind: "LIST",
    labelUk: "Цільові аудиторії",
    questionUk: "З якими цільовими групами ви працюєте?",
    documentEvidencePossible: true,
  },
  {
    key: "team_size",
    group: "CAPACITY",
    kind: "NUMBER",
    labelUk: "Розмір команди",
    questionUk: "Скільки людей працює в організації?",
    documentEvidencePossible: true,
  },
  {
    /**
     * Hryvnia, and the key says so.
     *
     * It used to be `annual_budget_eur` while the question said only «Який
     * приблизний річний бюджет організації?» — no currency anywhere a person
     * could see it. A Ukrainian NGO answers that in hryvnia, its annual report
     * states it in hryvnia, and the extractor duly pulled «3 480 000» out of a
     * sentence ending «гривень» and filed it as euro. That is a forty-fold
     * overstatement handed to the eligibility agent as a fact about the
     * organization, against calls whose thresholds are written in euro.
     *
     * No conversion here. A rate we invented would be a number nobody can cite,
     * which is the failure this product is built to refuse; the currency is
     * stated instead and the reader does the arithmetic.
     */
    key: "annual_budget_uah",
    group: "CAPACITY",
    kind: "NUMBER",
    labelUk: "Річний бюджет, грн",
    questionUk: "Який приблизний річний бюджет організації у гривнях?",
    documentEvidencePossible: true,
  },
  {
    key: "cofinancing_capacity",
    group: "CAPACITY",
    kind: "BOOLEAN",
    labelUk: "Можливість співфінансування",
    questionUk: "Чи може організація забезпечити співфінансування проєкту?",
    documentEvidencePossible: false,
  },
  {
    key: "international_partners",
    group: "EXPERIENCE",
    kind: "LIST",
    labelUk: "Міжнародні партнери",
    questionUk: "Чи має організація партнерів за кордоном? Назвіть їх.",
    documentEvidencePossible: false,
  },
  {
    key: "international_project_experience",
    group: "EXPERIENCE",
    kind: "BOOLEAN",
    labelUk: "Досвід міжнародних проєктів",
    questionUk: "Чи реалізовувала організація проєкти спільно з іноземними партнерами?",
    documentEvidencePossible: true,
  },
  {
    key: "previous_grants",
    group: "EXPERIENCE",
    kind: "LIST",
    labelUk: "Попередні гранти",
    questionUk: "Які гранти організація отримувала раніше?",
    documentEvidencePossible: true,
  },
  {
    key: "previous_donors",
    group: "EXPERIENCE",
    kind: "LIST",
    labelUk: "Попередні донори",
    questionUk: "З якими донорами ви вже працювали?",
    documentEvidencePossible: true,
  },
  {
    key: "reporting_language_en",
    group: "CAPACITY",
    kind: "BOOLEAN",
    labelUk: "Звітність англійською",
    questionUk: "Чи може організація вести проєктну звітність англійською мовою?",
    documentEvidencePossible: false,
  },
] as const;

export const FACT_KEYS = FACT_REGISTRY.map((f) => f.key);

const BY_KEY = new Map(FACT_REGISTRY.map((f) => [f.key, f]));

export function factDefinition(key: string): FactDefinition | undefined {
  return BY_KEY.get(key);
}

/** Zod refinement so a rule cannot point at a fact key that does not exist. */
export const FactKey = z.string().refine((k) => BY_KEY.has(k), {
  message: "unknown fact key — add it to FACT_REGISTRY first",
});

/**
 * Backfill contract: adding a key here must be paired with a migration that
 * inserts an UNKNOWN OrganizationFact row for every existing organization.
 * Without it, existing orgs have an absent row rather than a stored UNKNOWN,
 * and the eligibility agent loses the distinction D4 exists to preserve.
 */

/**
 * The facts a concept note cannot be written without.
 *
 * Not a completeness score — a floor. These three say what the organization
 * does, for whom, and where, and every section of a concept note rests on at
 * least one of them. With none of them answered there is no subject matter, and
 * a model asked to write anyway does not stop: it invents one.
 *
 * It did. A brand-new organization with an empty profile produced a draft about
 * «недостатнє забезпечення доступу до сільськогосподарських ресурсів», a target
 * of «зменшити втрати у сільському господарстві на 20%», and a capacity section
 * reading «ГО «Сила Руху» має досвід у роботі з місцевими громадами та
 * сільськогосподарськими ресурсами. Організація вже проводить навчальні сесії».
 * None of it came from anywhere. Three of the eight sections closed with
 * «Ніяких конкретних даних не надано» while asserting agricultural expertise in
 * the same paragraph.
 *
 * The number check missed it, correctly by its own rules: «20%» is two digits
 * and two-digit numbers are ordinals and list counts far more often than they
 * are claims. Nothing catches a fabricated sentence with no digits in it, which
 * is why this is a precondition rather than another output filter.
 */
export const CONCEPT_PREREQUISITES = [
  "activity_areas",
  "target_audiences",
  "geographic_coverage",
] as const;

/**
 * The facts that decide whether matching an organisation is worth the model's
 * time — the line between "assess" and "motivate".
 *
 * Drawn from live data, not a guess. Across every organisation matched during
 * trial operation, the ones that earned a recommendation all carried four or
 * five of these; the ones that carried none produced forty to fifty UNCERTAIN
 * verdicts and not a single recommendation, at ~3 minutes of model time each.
 * These five are also what the prefilter reads — applicant type, non-profit
 * status, region, and the two sector fields — so an organisation missing them
 * cannot be ruled in or out of anything, only left UNCERTAIN.
 *
 * The threshold is four of five, not all five: an organisation one fact short
 * still matched usefully in the data, and demanding a full house would nudge
 * people who are already answerable. Below four, the honest move is to ask them
 * to fill the profile rather than burn a night assessing a blank.
 */
export const CORE_FACT_KEYS = [
  "legal_form",
  "non_profit_status",
  "registration_oblast",
  "activity_areas",
  "sectors",
] as const;

export const CORE_FACTS_REQUIRED = 4;

/**
 * Where an organisation sits against that line, and which core facts it still
 * owes. `missing` is ordered as `CORE_FACT_KEYS` is, so a nudge lists them in a
 * stable, sensible order rather than however a Set iterates.
 */
export function coreFactStatus(answeredKeys: Iterable<string>): {
  answered: number;
  missing: FactDefinition[];
  ready: boolean;
} {
  const have = new Set(answeredKeys);
  const missing = CORE_FACT_KEYS.filter((k) => !have.has(k)).map((k) => BY_KEY.get(k)!);
  return {
    answered: CORE_FACT_KEYS.length - missing.length,
    missing,
    ready: CORE_FACT_KEYS.length - missing.length >= CORE_FACTS_REQUIRED,
  };
}
