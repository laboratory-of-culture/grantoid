/**
 * Send the weekly digest to everyone due one.
 *
 *   npx tsx scripts/send-digests.ts [--force]
 *
 * Without SMTP configured this writes the messages to `.mail/` instead of
 * sending them, which is the right default: a half-configured install that
 * silently mails real NGOs is worse than one that visibly mails nobody.
 */

import { sendDueDigests } from "../packages/notifications/send";
import { prisma } from "../packages/db/tenancy";

async function main(): Promise<void> {
  const outcome = await sendDueDigests({ force: process.argv.includes("--force") });

  console.log(`transport    ${outcome.transport}`);
  console.log(`considered   ${outcome.considered}`);
  console.log(`sent         ${outcome.sent}`);
  console.log(`nudged       ${outcome.nudged}   (profile too thin — sent a fill-in reminder)`);
  console.log(`skipped      ${outcome.skippedEmpty}   (nothing new worth an email)`);
  console.log(`failed       ${outcome.failed}`);

  for (const err of outcome.errors) {
    console.log(`\n  ! ${err.email}`);
    console.log(`    ${err.error.slice(0, 200)}`);
  }

  if (outcome.transport === "file") {
    console.log(`\nповідомлення у .mail/ — SMTP не налаштовано`);
  }
  console.log("");
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
