/**
 * What discovery found and what became of it.
 *
 *   npx tsx scripts/inspect-items.ts [status]
 */

import { prisma } from "../packages/db/tenancy";

async function main(): Promise<void> {
  const status = process.argv[2];

  const items = await prisma.sourceItem.findMany({
    where: status ? { status: status as never } : {},
    orderBy: [{ status: "asc" }, { discoveredAt: "desc" }],
    include: { source: { select: { name: true } } },
  });

  for (const item of items) {
    console.log(`[${item.status.padEnd(9)}] ${item.title.slice(0, 66)}`);
    console.log(`             ${item.url}`);
    if (item.statusNote) console.log(`             ${item.statusNote.slice(0, 220)}`);
    console.log("");
  }

  console.log(`${items.length} items`);
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
