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
