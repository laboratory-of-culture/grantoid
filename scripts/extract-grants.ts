/**
 * Turn classified items into Grant records.
 *
 *   npx tsx scripts/extract-grants.ts [limit]
 */

import { extractPending } from "../packages/ingestion/extract";
import { checkRuntime } from "../packages/llm/ollama";
import { prisma } from "../packages/db/tenancy";

async function main(): Promise<void> {
  await checkRuntime();

  const result = await extractPending(Number(process.argv[2] ?? 20));

  console.log(`examined   ${result.examined}`);
  console.log(`extracted  ${result.extracted}`);
  console.log(`rejected   ${result.rejected}   (full page showed it was not a grant)`);
  console.log(`failed     ${result.failed}`);
  console.log(`took ${(result.durationMs / 1000).toFixed(1)}s\n`);

  for (const err of result.errors) {
    console.log(`  ! ${err.title.slice(0, 60)}`);
    console.log(`    ${err.error.slice(0, 160)}`);
  }

  const grants = await prisma.grant.findMany({
    orderBy: { extractionConfidence: "desc" },
    include: { rules: { include: { citations: true } } },
  });

  for (const grant of grants) {
    console.log(`\n${"─".repeat(78)}`);
    console.log(`${grant.titleUk ?? grant.title}`);
    console.log(`  донор       ${grant.donorName}`);
    console.log(
      `  дедлайн     ${grant.deadline ? grant.deadline.toISOString().slice(0, 10) : "невідомо"}`,
    );
    console.log(
      `  сума        ${grant.fundingMax ? `${grant.fundingMax} ${grant.currency ?? ""}` : "невідомо"}`,
    );
    console.log(`  сфери       ${grant.sectors.join(", ") || "—"}`);
    console.log(`  заявники    ${grant.applicantTypes.join(", ") || "—"}`);
    console.log(`  повнота     ${Math.round(grant.extractionConfidence * 100)}%`);
    console.log(`  правил      ${grant.rules.length}`);

    for (const rule of grant.rules) {
      console.log(`    [${rule.kind.padEnd(9)}] ${rule.text.slice(0, 66)}`);
      console.log(
        `      ↳ ${rule.resolvingFactKey ?? "профіль загалом"} · «${(rule.citations[0]?.quote ?? "").slice(0, 60)}…»`,
      );
    }

    if (grant.extractionNotes) {
      console.log(`  не прочитано:`);
      for (const note of grant.extractionNotes.split("; ")) console.log(`    · ${note}`);
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
