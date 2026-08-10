/**
 * Classify everything discovery has found but nobody has judged.
 *
 *   npx tsx scripts/classify.ts [limit]
 */

import { classifyPending } from "../packages/ingestion/classify";
import { checkRuntime } from "../packages/llm/ollama";
import { prisma } from "../packages/db/tenancy";

async function main(): Promise<void> {
  await checkRuntime();

  const limit = Number(process.argv[2] ?? 50);
  const result = await classifyPending(limit);

  console.log(`examined   ${result.examined}`);
  console.log(`  by rule  ${result.byRule}   (no model call)`);
  console.log(`  by agent ${result.byAgent}`);
  console.log("");
  console.log(`grants     ${result.grants}`);
  console.log(`rejected   ${result.rejected}`);
  console.log(`deferred   ${result.deferred}   (left for a person)`);
  console.log(`failed     ${result.failed}`);
  console.log(`\ntook ${(result.durationMs / 1000).toFixed(1)}s\n`);

  const rows = await prisma.sourceItem.findMany({
    orderBy: [{ status: "asc" }, { title: "asc" }],
    include: { source: { select: { name: true } } },
    take: 40,
  });

  for (const row of rows) {
    const mark = row.status === "GRANT" ? "+" : row.status === "NOT_GRANT" ? "-" : "?";
    console.log(`${mark} [${row.status.padEnd(9)}] ${row.title.slice(0, 62)}`);
    if (row.statusNote) console.log(`            ${row.statusNote.slice(0, 90)}`);
  }
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
