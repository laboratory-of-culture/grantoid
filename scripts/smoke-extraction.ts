/**
 * End-to-end smoke for the knowledge path: upload → text → agent → candidates.
 *
 *   npx tsx scripts/smoke-extraction.ts
 *
 * Uses a short synthetic statute rather than a real one — the point is to prove
 * the chain runs and that the verbatim check bites, not to test a specific
 * document. Cleans up after itself.
 */

import { deleteDocument, uploadDocument } from "../packages/db/documents";
import { extractDocumentFacts } from "../packages/db/extraction";
import { checkRuntime } from "../packages/llm/ollama";
import { forOrganization, prisma } from "../packages/db/tenancy";

const STATUT = `СТАТУТ ГРОМАДСЬКОЇ ОРГАНІЗАЦІЇ «ПОРОГИ»

1.1. Громадська організація «Пороги» (далі — Організація) є неприбутковою громадською організацією, створеною відповідно до законодавства України.

1.2. Повне найменування: Громадська організація «Пороги».

1.3. Організацію зареєстровано 11 квітня 2019 року.

1.4. Місцезнаходження Організації: місто Житомир, Житомирська область, Україна.

2.1. Метою діяльності Організації є розвиток сучасної культурної сцени Житомирщини та залучення мешканців малих міст до участі в культурному житті.

2.2. Основними напрямами діяльності є організація культурних подій, освітні програми для митців та робота з локальними громадами.

3.1. Організація не має на меті одержання прибутку та не розподіляє доходи серед засновників.
`;

async function main(): Promise<void> {
  await checkRuntime();

  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) {
    console.error("No organization. Run: npx tsx packages/db/seed.ts");
    process.exit(1);
  }

  const db = forOrganization(org.id);
  console.log(`organization  ${org.name}`);

  const doc = await uploadDocument(db, {
    organizationId: org.id,
    filename: `smoke-statut-${Date.now()}.txt`,
    mimeType: "text/plain",
    kind: "STATUT",
    bytes: new TextEncoder().encode(STATUT),
  });
  console.log(`uploaded      ${doc.filename} (${doc.sizeBytes} bytes)\n`);

  const started = Date.now();
  const summary = await extractDocumentFacts(db, doc.id);
  console.log(
    `extracted     ${summary.proposed} proposed, ${summary.discarded} discarded ` +
      `in ${((Date.now() - started) / 1000).toFixed(1)}s\n`,
  );

  const candidates = await db.factCandidate.findMany({
    where: { documentId: doc.id },
    orderBy: { key: "asc" },
  });

  for (const c of candidates) {
    console.log(`  ${c.key}  [${c.state}]  conf ${c.confidence.toFixed(2)}`);
    console.log(`    значення: ${c.valueText}`);
    console.log(`    цитата:   «${c.quote.slice(0, 110)}»\n`);
  }

  if (summary.discarded > 0) {
    console.log(
      `  ${summary.discarded} proposal(s) were dropped because the quotation was\n` +
        "  not in the document. That check is the point of the agent.\n",
    );
  }

  await deleteDocument(db, doc.id);
  console.log("cleaned up");
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
