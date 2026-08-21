/**
 * Deciding what a discovered item is, without a model where possible.
 *
 * `agent-authoring` says it plainly: if the work is deterministic, it is code.
 * ГУРТ prefixes every headline with its own type marker — ГРАНТ, КОНКУРС,
 * ТЕНДЕР, ВАКАНСІЇ — which is an editorial convention, free to read, and more
 * reliable than anything a 4B model would infer from the same string. Громадський
 * Простір has no such marker, so most of its items fall through to the agent.
 *
 * The rules are anchored to the start of a title on purpose. A grant
 * announcement may well mention "закупівля обладнання" in its body; an item that
 * *is* a procurement notice says so first.
 */

export type RuleVerdict = {
  status: "GRANT" | "NOT_GRANT";
  /** Why, in the words shown to an operator. */
  note: string;
};

/**
 * Leading markers that settle the question.
 *
 * The word boundary is `(?!\p{L})`, not `\b`. JavaScript defines `\b` in terms
 * of `\w`, which is `[A-Za-z0-9_]` and contains no Cyrillic at all — so `/^грант\b/`
 * never matches "ГРАНТ Гранти…", because there is no boundary between a letter
 * the engine does not recognise as a word character and the space after it.
 * Every rule here would have silently failed, and the tests are what said so.
 */
const LEADING: { pattern: RegExp; status: "GRANT" | "NOT_GRANT"; note: string }[] = [
  // Before the taxonomy markers, because it is the more specific reading of the
  // same word. «Конкурс на закупівлю соняної електростанції» is real: the
  // leading «конкурс» matched the marker below, the item was filed as a grant
  // without a model ever seeing it, and it reached the grant table at 64%.
  // A competition to *buy* something puts the organization on the paying side.
  {
    pattern: /^конкурс\s+(на|з)\s+закупівл/iu,
    status: "NOT_GRANT",
    note: "конкурс на закупівлю — організація тут покупець, а не отримувач",
  },

  // ГУРТ's own taxonomy.
  { pattern: /^грант(?!\p{L})/iu, status: "GRANT", note: "ГУРТ позначив як ГРАНТ" },
  { pattern: /^конкурс(?!\p{L})/iu, status: "GRANT", note: "ГУРТ позначив як КОНКУРС" },
  { pattern: /^стипенді/iu, status: "GRANT", note: "стипендіальна програма" },
  { pattern: /^тендер(?!\p{L})/iu, status: "NOT_GRANT", note: "тендер, а не грант" },
  { pattern: /^вакансі/iu, status: "NOT_GRANT", note: "вакансія" },
  { pattern: /^стажуванн/iu, status: "NOT_GRANT", note: "стажування" },

  // Procurement, which both sources publish alongside grants.
  { pattern: /^закупівл/iu, status: "NOT_GRANT", note: "закупівля товарів або послуг" },
  { pattern: /^запит цінових пропозиц/iu, status: "NOT_GRANT", note: "запит цінових пропозицій" },
  { pattern: /^оголошення про закупівл/iu, status: "NOT_GRANT", note: "закупівля" },
  { pattern: /^послуги з(?!\p{L})/iu, status: "NOT_GRANT", note: "закупівля послуг" },
  { pattern: /^надання послуг/iu, status: "NOT_GRANT", note: "закупівля послуг" },
  { pattern: /^консультант/iu, status: "NOT_GRANT", note: "закупівля консультаційних послуг" },
  { pattern: /^consultancy(?!\p{L})/iu, status: "NOT_GRANT", note: "закупівля консультаційних послуг" },
  { pattern: /^request for (proposal|quotation)/iu, status: "NOT_GRANT", note: "тендерний запит" },
];

/** A digest is a list of other announcements, not an opportunity in itself. */
const DIGEST = /дайджест|огляд можливостей|добірка можливостей/i;

/**
 * Classify by rule, or return null to defer to the agent.
 *
 * Returning null is the common case for Громадський Простір and the right
 * default: a wrong rule is worse than a model call, because a rule fails
 * silently and identically on every future item.
 */
export function classifyByRule(title: string): RuleVerdict | null {
  const text = title.trim();

  if (DIGEST.test(text)) {
    return { status: "NOT_GRANT", note: "дайджест — перелік інших оголошень" };
  }

  for (const rule of LEADING) {
    if (rule.pattern.test(text)) {
      return { status: rule.status, note: rule.note };
    }
  }

  return null;
}
