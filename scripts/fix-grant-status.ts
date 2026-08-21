/**
 * Recompute stored grant status from the stored deadline.
 *
 * Three writers each computed `deadline ? "OPEN" : "UNKNOWN"`, so every call
 * whose deadline had already passed was stored as open. The rule now lives in
 * `statusForDeadline`, but a fix on the write path does not reach rows already
 * written — the third time that has come up, and the reason this script exists
 * rather than a comment saying it will sort itself out on re-crawl.
 */

import { prisma } from "../packages/db/tenancy";
import { statusForDeadline } from "../packages/schemas/grant";

async function main(): Promise<void> {
  const grants = await prisma.grant.findMany({
    select: { id: true, titleUk: true, title: true, deadline: true, status: true },
  });

  const now = new Date();
  let changed = 0;
  for (const g of grants) {
    const correct = statusForDeadline(g.deadline, now);
    if (correct === g.status) continue;
    await prisma.grant.update({ where: { id: g.id }, data: { status: correct } });
    changed += 1;
    console.log(
      `  ${g.status} → ${correct}  ${g.deadline?.toISOString().slice(0, 10) ?? "без дати"}  ` +
        `${(g.titleUk ?? g.title).slice(0, 60)}`,
    );
  }
  console.log(`${changed} of ${grants.length} corrected`);
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
