/**
 * Strip the portal's rubric label from titles already stored.
 *
 * `stripRubric` now runs at extraction, so new calls arrive clean. The rows
 * already written keep «ГРАНТ Гранти на розвиток адаптивного спорту» — and
 * they are the ones in today's feed, in today's digest, and in the title of any
 * concept note written against them.
 *
 * Fourth time a write-path fix has needed one of these. Cheap and idempotent:
 * running it twice changes nothing the second time.
 */

import { stripRubric } from "../packages/ingestion/discover";
import { prisma } from "../packages/db/tenancy";

async function main(): Promise<void> {
  const grants = await prisma.grant.findMany({
    select: { id: true, title: true, titleUk: true },
  });

  let changed = 0;
  for (const g of grants) {
    const title = stripRubric(g.title);
    const titleUk = g.titleUk === null ? null : stripRubric(g.titleUk);
    if (title === g.title && titleUk === g.titleUk) continue;

    await prisma.grant.update({ where: { id: g.id }, data: { title, titleUk } });
    changed += 1;
    console.log(`  ${g.titleUk ?? g.title}\n→ ${titleUk ?? title}`);
  }

  // Concept titles are copied from the call when a draft is created, so they
  // carry the label too — and that one ends up in the exported filename.
  const concepts = await prisma.conceptDraft.findMany({ select: { id: true, title: true } });
  let conceptsChanged = 0;
  for (const c of concepts) {
    const title = stripRubric(c.title);
    if (title === c.title) continue;
    await prisma.conceptDraft.update({ where: { id: c.id }, data: { title } });
    conceptsChanged += 1;
  }

  console.log(
    `${changed} of ${grants.length} grants corrected, ` +
      `${conceptsChanged} of ${concepts.length} concept titles`,
  );
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
