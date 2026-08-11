/**
 * The organization profile as prose, for any agent that reads it.
 *
 * Shared rather than duplicated because two things depend on it being byte-identical
 * across agents: the eligibility agent's citations are verified by looking the
 * quote up in this text, and the concept generator has to draw on the same
 * sentences a verdict was argued from. Two renderings that drift would let a
 * concept claim capacity that no verdict could cite.
 *
 * It is prose and not JSON for a reason that cost a defect to learn: whatever
 * the model is shown is what it quotes back, and a quote in JSON notation
 * reaches the screen as evidence a person cannot check.
 */

import { factDefinition } from "./fact-registry";
import { LEGAL_FORM_LABEL_UK, type OrganizationProfile } from "./organization";
import type { FactState } from "./verdict";

const STATE_SUFFIX_UK: Record<FactState, string> = {
  CONFIRMED: "Підтверджено документом.",
  SELF_REPORTED: "Зі слів організації, без документа.",
  EXPLICIT_NEGATIVE: "Організація підтвердила, що цього немає.",
  UNKNOWN: "",
};

export function factValueUk(fact: OrganizationProfile["facts"][number]): string | null {
  if (fact.valueList !== null && fact.valueList.length > 0) return fact.valueList.join("; ");
  if (fact.valueText !== null) return fact.valueText;
  if (fact.valueNumber !== null) return String(fact.valueNumber);
  if (fact.valueBoolean !== null) return fact.valueBoolean ? "так" : "ні";
  return null;
}

/** One profile fact as a sentence a person would recognise from their own profile page. */
export function factSentence(fact: OrganizationProfile["facts"][number]): string {
  const label = factDefinition(fact.key)?.labelUk ?? fact.key;

  if (fact.state === "UNKNOWN") {
    return `${label}: організація не відповідала на це питання.`;
  }

  const value = factValueUk(fact);
  const suffix = STATE_SUFFIX_UK[fact.state];

  if (fact.state === "EXPLICIT_NEGATIVE") {
    return `${label}: ${value ?? "ні"}. ${suffix}`;
  }
  return `${label}: ${value ?? "—"}. ${suffix}`;
}

/**
 * The whole profile.
 *
 * Answered facts first: eighteen rows, most unanswered, bury the handful that
 * decide anything, and on a 4B model that matters more than it would on a larger
 * one. The unanswered ones still appear, because both agents depend on seeing
 * that a question was never asked rather than inferring it from a gap — for the
 * eligibility agent that is the difference between UNCERTAIN and a rejection,
 * and for the generator it is the difference between leaving a section thin and
 * inventing its content.
 */
export function renderProfileText(org: OrganizationProfile): string {
  const answered = org.facts.filter((f) => f.state !== "UNKNOWN");
  const unanswered = org.facts.filter((f) => f.state === "UNKNOWN");

  return [
    `Назва: ${org.name}.`,
    org.legalForm ? `Правова форма: ${LEGAL_FORM_LABEL_UK[org.legalForm]}.` : null,
    org.oblast ? `Область: ${org.oblast}.` : null,
    org.city ? `Місто: ${org.city}.` : null,
    "",
    "## Що організація про себе повідомила",
    ...answered.map(factSentence),
    "",
    "## Питання, на які організація не відповідала",
    ...unanswered.map(factSentence),
  ]
    .filter((line) => line !== null)
    .join("\n");
}
