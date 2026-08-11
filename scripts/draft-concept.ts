/**
 * Draft a concept note for one grant.
 *
 *   npx tsx scripts/draft-concept.ts [grantId] [email]
 *
 * Prints the whole draft, because the only way to judge this agent is to read
 * what it wrote — a section count tells you nothing about whether it invented a
 * number.
 */

import { generateDraft, loadConcept } from "../packages/db/concepts";
import { checkRuntime } from "../packages/llm/ollama";
import { prisma } from "../packages/db/tenancy";

async function main(): Promise<void> {
  await checkRuntime();

  const email = process.argv[3] ?? "laboratoryofculture@gmail.com";
  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: true },
  });
  const organizationId = user?.memberships[0]?.organizationId;
  if (!organizationId) throw new Error(`no organization for ${email}`);

  let grantId = process.argv[2];
  if (!grantId) {
    const best = await prisma.match.findFirst({
      where: { organizationId },
      orderBy: [{ recommend: "desc" }, { matchScore: "desc" }],
      select: { grantId: true },
    });
    grantId = best?.grantId;
  }
  if (!grantId) throw new Error("no grant to draft against — run scripts/build-feed.ts first");

  const started = Date.now();
  await generateDraft(organizationId, grantId);
  const view = await loadConcept(organizationId, grantId);
  if (!view) throw new Error("draft was not stored");

  console.log(`\n${view.title}`);
  console.log(`${(Date.now() - started) / 1000}s · ${view.sections.length} секцій · `
    + `${view.unreviewed.length} не прочитано\n`);

  for (const section of view.sections) {
    console.log("─".repeat(78));
    console.log(`${section.labelUk}   [${section.source}]`);
    console.log(section.content);
    console.log("");
  }
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
