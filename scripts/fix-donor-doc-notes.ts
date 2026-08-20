/**
 * Rewrite the closing note on calls created from a donor's own document.
 *
 * `extractGrant` used to end every record with «умови донора (PDF/сайт) не
 * читалися», which is true of an announcement and false of a PDF the donor
 * mailed — there the guidelines *are* the input. The agent now says which it
 * read, but a fix on the write path cannot reach rows already stored, and the
 * rows already stored are the ones an organization is looking at today.
 *
 * A private grant is only ever created from a document (`createGrantFromDocument`
 * is the sole writer of `ownerOrganizationId`), so ownership identifies them.
 */
import { prisma } from "../packages/db/tenancy";

const WRONG = "умови донора (PDF/сайт) не читалися — перевірте оригінал оголошення";
const RIGHT = "прочитано документ донора; звіряйте з оригіналом перед подачею";
const WRONG_TRUNC = "сторінку обрізано — прочитано не весь текст";
const RIGHT_TRUNC = "документ довший за те, що вміщає модель — прочитано лише початок";

async function main(): Promise<void> {
  const rows = await prisma.grant.findMany({
    where: { ownerOrganizationId: { not: null } },
    select: { id: true, titleUk: true, extractionNotes: true },
  });

  let changed = 0;
  for (const row of rows) {
    const fixed = (row.extractionNotes ?? "")
      .replace(WRONG, RIGHT)
      .replace(WRONG_TRUNC, RIGHT_TRUNC);
    if (fixed === row.extractionNotes) continue;
    await prisma.grant.update({ where: { id: row.id }, data: { extractionNotes: fixed } });
    changed += 1;
    console.log(`  ${row.titleUk}`);
  }
  console.log(`${changed} of ${rows.length} private grant(s) corrected`);
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
