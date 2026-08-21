/**
 * Print the weekly email for one organization, without sending it.
 *
 *   npx tsx scripts/preview-digest.ts [email]
 *
 * `send-digests.ts` respects the schedule, the subscription and the seven-day
 * interval, which is right for the cron entry and useless when the question is
 * "what does the letter look like". This builds the same message with the same
 * function and prints it.
 *
 * Nothing is written and nothing is sent — deliberately, so this can be run
 * against a production database to answer a support question.
 */

import { buildDigest, selectForDigest } from "../packages/notifications/digest";
import { prisma } from "../packages/db/tenancy";
import { loadFeed } from "../packages/matching/feed";

const EMAIL = process.argv[2] ?? "laboratoryofculture@gmail.com";

async function main(): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
    include: { memberships: { include: { organization: true } } },
  });
  const membership = user?.memberships[0];
  if (!membership) throw new Error(`no organization for ${EMAIL}`);

  const now = new Date();
  const feed = await loadFeed(membership.organizationId, { limit: 200 });

  // The window the scheduled job uses, so the preview shows what would actually
  // go out. `--all` drops it and shows every recommended call instead, which is
  // what you want when the question is about the layout rather than about
  // today's contents.
  const all = process.argv.includes("--all");
  const since = all ? null : new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  let picked = selectForDigest(feed.entries, since, now);

  // `--layout` also keeps the hand-authored test records, which `selectForDigest`
  // drops and should. Nothing else in the product lets you look at a filled-in
  // letter before live data happens to produce one, and reading the layout is a
  // different question from reading today's contents.
  if (process.argv.includes("--layout")) {
    picked = feed.entries
      .filter((e) => e.recommend)
      .filter((e) => !e.deadlineIsKnown || e.deadline === null || e.deadline >= now);
    console.log("(вигляд листа; включно з тестовими записами, які справжня розсилка відкидає)\n");
  }

  const digest = buildDigest(
    membership.organization.name,
    picked,
    "http://localhost:3000",
    user!.unsubscribeToken ?? "<токен буде видано під час першої розсилки>",
  );

  console.log(`Кому:  ${EMAIL}`);
  console.log(`Тема:  ${digest.subject}`);
  console.log(`List-Unsubscribe: <${digest.unsubscribeUrl}>`);
  console.log("─".repeat(72));
  console.log(digest.text);
  console.log("─".repeat(72));
  console.log(
    `\n${picked.length} з ${feed.entries.length} у стрічці потрапили б у лист` +
      (all ? " (усі рекомендовані)." : " (рекомендовані, знайдені за останні 7 днів)."),
  );

  // Said plainly, because the preview does not obey it: `sendDueDigests` counts
  // an empty digest as `skippedEmpty` and sends nothing. A weekly letter saying
  // «0 нових можливостей» is the letter people unsubscribe from.
  if (picked.length === 0) {
    console.log("Такий лист не пішов би: порожній дайджест не надсилається.");
  }
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
