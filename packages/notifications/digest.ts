/**
 * What goes in a weekly digest, and — more importantly — what does not.
 *
 * The digest names public information: grant titles, donors, deadlines, and how
 * many opportunities are new. It carries **no eligibility verdicts, no profile
 * facts, no citations and no concept text**. Those are the organization's own
 * material and the product's own reasoning, and neither belongs in a message
 * that crosses an SMTP relay, sits in a provider's storage and is searchable by
 * anyone who later gets into that mailbox.
 *
 * That line is not free — a digest that said «ви ймовірно прийнятні» would be
 * more useful. It is drawn where it is because D1 promises that an
 * organization's data stays in this infrastructure, and a promise with an
 * exception for convenience is not one.
 *
 * Building the content is separate from sending it so the decision about what
 * leaves can be read, and tested, without a mail server.
 */

import type { FeedEntry } from "../matching/feed";
import { NOUN_UK, countUk, formatDateUk } from "../schemas/locale-uk";

export type DigestEntry = {
  titleUk: string;
  donorName: string;
  deadline: Date | null;
  deadlineIsKnown: boolean;
  url: string;
};

export type Digest = {
  subject: string;
  text: string;
  entries: DigestEntry[];
  /** Also sent as a `List-Unsubscribe` header — see `mail.ts`. */
  unsubscribeUrl: string;
};

/**
 * New since the last digest, recommended, and not already closed.
 *
 * "New" is `firstSeenAt` — when ingestion found the call — and deliberately not
 * `computedAt`. A verdict is recomputed whenever the profile changes, which
 * re-stamps every grant in the feed at once; measuring newness by that would
 * mail somebody their entire feed again as "нові можливості" because they
 * answered one profile question. Re-sending a call the person already read is
 * how a digest they opted into turns into the thing they report as spam.
 */
export function selectForDigest(
  entries: readonly FeedEntry[],
  since: Date | null,
  now: Date,
): FeedEntry[] {
  return entries
    .filter((e) => e.recommend)
    .filter((e) => !e.synthetic)
    .filter((e) => since === null || e.firstSeenAt > since)
    .filter((e) => !e.deadlineIsKnown || e.deadline === null || e.deadline >= now)
    .sort((a, b) => {
      const aDue = a.deadlineIsKnown && a.deadline ? a.deadline.getTime() : Infinity;
      const bDue = b.deadlineIsKnown && b.deadline ? b.deadline.getTime() : Infinity;
      return aDue - bDue;
    });
}

/**
 * Ukrainian plural for a count of opportunities.
 *
 * The adjective agrees too, which is why this is not a bare `countUk` call: it
 * is «1 нова можливість» and «3 нові можливості», not one adjective with three
 * nouns hung off it.
 */
export function opportunitiesUk(n: number): string {
  return countUk(n, {
    one: "нова можливість",
    few: "нові можливості",
    many: `нових ${NOUN_UK.opportunity.many}`,
  });
}

export function buildDigest(
  organizationName: string,
  entries: readonly FeedEntry[],
  baseUrl: string,
  unsubscribeToken: string,
): Digest {
  const picked: DigestEntry[] = entries.map((e) => ({
    titleUk: e.titleUk,
    donorName: e.donorName,
    deadline: e.deadline,
    deadlineIsKnown: e.deadlineIsKnown,
    url: `${baseUrl}/hranty/${e.grantId}`,
  }));

  // Built once and returned, because the header and the body have to point at
  // the same place — a client's native unsubscribe and the link in the text
  // disagreeing is the kind of thing nobody notices until it matters.
  const unsubscribeUrl = `${baseUrl}/vidpyska?t=${unsubscribeToken}`;

  const lines = [
    `${organizationName} — ${opportunitiesUk(picked.length)} у стрічці.`,
    "",
    ...picked.flatMap((e) => [
      `• ${e.titleUk}`,
      `  ${e.donorName}${
        e.deadlineIsKnown && e.deadline
          ? ` · подання до ${formatDateUk(e.deadline)}`
          : " · термін не вказано в оголошенні"
      }`,
      `  ${e.url}`,
      "",
    ]),
    "Чому саме ці — з розбором за критеріями та цитатами — у застосунку:",
    `${baseUrl}/mozhlyvosti`,
    "",
    "Цей лист не містить оцінки прийнятності, даних вашого профілю чи тексту заявок —",
    "вони не залишають нашої інфраструктури. У листі лише публічні дані про конкурси.",
    "",
    "Система в режимі дослідної експлуатації: добір ще не перевірено на живих даних.",
    "",
    `Відписатися: ${unsubscribeUrl}`,
  ];

  return {
    subject: `${opportunitiesUk(picked.length)} для ${organizationName}`,
    text: lines.join("\n"),
    entries: picked,
    unsubscribeUrl,
  };
}
