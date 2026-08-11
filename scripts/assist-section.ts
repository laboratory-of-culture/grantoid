/**
 * Ask the assistant to revise one section, and read what it proposed.
 *
 *   npx tsx scripts/assist-section.ts <grantId> <sectionKey> "<instruction>"
 *
 * Prints the suggestion rather than saving it, which is what the assistant does
 * in the product too — accepting is a person's act.
 */

import { suggestSectionRevision } from "../packages/db/concepts";
import { checkRuntime } from "../packages/llm/ollama";
import { prisma } from "../packages/db/tenancy";

async function main(): Promise<void> {
  await checkRuntime();

  const email = process.env.SMOKE_EMAIL ?? "laboratoryofculture@gmail.com";
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    include: { memberships: true },
  });
  const organizationId = user.memberships[0]?.organizationId;
  if (!organizationId) throw new Error(`no organization for ${email}`);

  const grantId = process.argv[2];
  const key = process.argv[3] ?? "problem";
  const instruction = process.argv[4] ?? "Скоротити вдвічі та прибрати повтори";
  if (!grantId) throw new Error("usage: assist-section.ts <grantId> <sectionKey> <instruction>");

  const started = Date.now();
  const suggestion = await suggestSectionRevision(organizationId, grantId, key, instruction);

  console.log(`\nінструкція: ${instruction}`);
  console.log(`${((Date.now() - started) / 1000).toFixed(1)}s\n`);
  console.log(`що змінено: ${suggestion.changeNoteUk}`);
  console.log(
    `числа без джерела: ${
      suggestion.unsupportedFigures.length > 0 ? suggestion.unsupportedFigures.join(", ") : "—"
    }\n`,
  );
  console.log(suggestion.content);
  console.log("");
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
