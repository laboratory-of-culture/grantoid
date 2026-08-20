/**
 * Which matches are recommended, and which of those are fixtures.
 *
 *   npx tsx scripts/inspect-matches.ts
 *
 * The distinction matters for the digest: a fixture is never mailed, so a
 * recommended fixture and a recommended live call look the same in a count and
 * mean opposite things about whether anyone will receive anything.
 */

import { prisma } from "../packages/db/tenancy";

async function main(): Promise<void> {
  const rows = await prisma.match.findMany({
    include: { grant: { select: { synthetic: true, titleUk: true, title: true } } },
    orderBy: [{ recommend: "desc" }],
  });

  for (const row of rows) {
    const kind = row.grant.synthetic ? "фікстура" : "живий   ";
    const rec = row.recommend ? "РЕКОМЕНДОВАНО" : "—            ";
    console.log(`${kind}  ${rec}  ${(row.grant.titleUk ?? row.grant.title).slice(0, 50)}`);
  }

  const mailable = rows.filter((r) => r.recommend && !r.grant.synthetic).length;
  console.log(`\nдо розсилки придатних: ${mailable} із ${rows.length}`);
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
