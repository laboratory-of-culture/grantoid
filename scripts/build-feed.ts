/**
 * Build one organization's feed.
 *
 *   npx tsx scripts/build-feed.ts [email] [grantLimit]
 *
 * Prints what the deterministic gate settled before anything reached a model,
 * because that ratio is the number that decides whether this product works on
 * the hardware it runs on.
 */

import { loadFeed } from "../packages/matching/feed";
import { matchOrganization } from "../packages/matching/run";
import { checkRuntime } from "../packages/llm/ollama";
import { prisma } from "../packages/db/tenancy";

const EMAIL = process.argv[2] ?? "laboratoryofculture@gmail.com";

async function main(): Promise<void> {
  await checkRuntime();

  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
    include: { memberships: true },
  });
  const organizationId = user?.memberships[0]?.organizationId;
  if (!organizationId) throw new Error(`no organization for ${EMAIL}`);

  const outcome = await matchOrganization(organizationId, {
    limit: Number(process.argv[3] ?? 200),
  });

  console.log(`candidates   ${outcome.candidates}`);
  console.log(`  filtered   ${outcome.filtered}   (no model call)`);
  console.log(`  reused     ${outcome.reused}   (inputs unchanged)`);
  console.log(`  assessed   ${outcome.assessed}`);
  console.log(`  failed     ${outcome.failed}`);
  console.log(`recommended  ${outcome.recommended}`);
  console.log(`took ${(outcome.durationMs / 1000).toFixed(1)}s`);

  if (outcome.assessed > 0) {
    console.log(
      `             ${(outcome.durationMs / 1000 / outcome.assessed).toFixed(1)}s per assessed pair`,
    );
  }

  for (const err of outcome.errors) {
    console.log(`\n  ! ${err.title.slice(0, 60)}`);
    console.log(`    ${err.error.slice(0, 200)}`);
  }

  const feed = await loadFeed(organizationId);
  console.log(`\nfeed: ${feed.entries.length} entries`);
  console.log(
    `criteria by bucket: ${Object.entries(feed.byBucket)
      .map(([k, v]) => `${k}=${v}`)
      .join("  ")}\n`,
  );

  for (const entry of feed.entries) {
    console.log(`${"─".repeat(78)}`);
    console.log(`${entry.recommend ? "★" : " "} ${entry.titleUk.slice(0, 68)}`);
    console.log(
      `  ${entry.overall}  score ${entry.matchScore}  ` +
        `повнота оголошення ${Math.round(entry.extractionConfidence * 100)}%`,
    );
    console.log(`  ${entry.summary.slice(0, 160)}`);

    for (const c of entry.criteria) {
      console.log(`    [${c.bucket.padEnd(17)}] ${c.ruleTextUk.slice(0, 54)}`);
      if (c.missingInformation) console.log(`        бракує: ${c.missingInformation.slice(0, 60)}`);
    }
  }
  console.log("");
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
