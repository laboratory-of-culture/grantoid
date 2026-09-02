/**
 * Review one concept section and print what it found.
 *
 *   npx tsx scripts/review-section.ts <grantId> <sectionKey>
 *
 * Prints the findings rather than applying them, which is what the product does
 * too — a finding is a pointer, and every one of them is a decision for the
 * person who wrote the text.
 */

import { reviewConceptSection } from "../packages/db/concepts";
import { CATEGORY_LABEL_UK, spansFor } from "../packages/schemas/writing-checks";
import { checkRuntime } from "../packages/llm/ollama";
import { prisma } from "../packages/db/tenancy";
import { DEV_ORG_EMAIL } from "./dev-account";

async function main(): Promise<void> {
  await checkRuntime();

  const email = process.env.SMOKE_EMAIL ?? DEV_ORG_EMAIL;
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    include: { memberships: true },
  });
  const organizationId = user.memberships[0]?.organizationId;
  if (!organizationId) throw new Error(`no organization for ${email}`);

  const grantId = process.argv[2];
  const key = process.argv[3] ?? "problem";
  if (!grantId) throw new Error("usage: review-section.ts <grantId> <sectionKey>");

  const started = Date.now();
  const review = await reviewConceptSection(organizationId, grantId, key);

  const draft = await prisma.conceptDraft.findFirstOrThrow({
    where: { organizationId, grantId },
    include: { sections: true },
  });
  const content = draft.sections.find((s) => s.key === key)?.content ?? "";

  console.log(`\nсекція: ${key}   ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`знайдено: ${review.findings.length}   відкинуто фрагментів: ${review.dropped}\n`);
  console.log(content);
  console.log("");

  for (const finding of review.findings) {
    console.log("─".repeat(76));
    console.log(`[${CATEGORY_LABEL_UK[finding.category]}]  джерело: ${finding.source}`);
    console.log(`  фрагмент:  «${finding.quote}»`);
    console.log(`  чому:      ${finding.whyUk}`);
    console.log(`  що робити: ${finding.suggestionUk ?? "— (заміну має дати організація)"}`);
  }

  const spans = spansFor(review.findings, content);
  console.log(`\nпідсвічених фрагментів після зняття перетинів: ${spans.length}\n`);
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
