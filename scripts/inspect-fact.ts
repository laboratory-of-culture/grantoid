/**
 * What one profile fact actually holds.
 *
 *   npx tsx scripts/inspect-fact.ts international_partners
 */

import { prisma } from "../packages/db/tenancy";

async function main(): Promise<void> {
  const key = process.argv[2] ?? "international_partners";

  const facts = await prisma.organizationFact.findMany({
    where: { key },
    include: { organization: { select: { name: true } }, citations: true },
  });

  for (const fact of facts) {
    console.log(`${fact.organization.name}`);
    console.log(`  key        ${fact.key}`);
    console.log(`  state      ${fact.state}`);
    console.log(`  valueText  ${fact.valueText ?? "(null)"}`);
    console.log(`  valueJson  ${JSON.stringify(fact.valueJson)}`);
    console.log(`  confirmed  ${fact.confirmedAt?.toISOString() ?? "(never)"}`);
    console.log(`  citations  ${fact.citations.length}`);
  }
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
