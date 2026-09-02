/**
 * A test organization to log in as and look around.
 *
 *   npx tsx scripts/seed-demo-org.ts
 *
 * The profile is deliberately *incomplete*. A demo account with every field
 * filled in would show none of what this product is for: the difference between
 * a fact we hold, a fact the organization asserted, a fact it denied, and a fact
 * nobody has ever answered. Eight of the eighteen registry keys are left UNKNOWN
 * so the eligibility ladder has something honest to be uncertain about.
 *
 * Idempotent, and refuses to run against production — it creates an account
 * whose password is written in the clear to a file.
 */

import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

import { hashPassword } from "../packages/auth/password";
import { FACT_KEYS } from "../packages/schemas/fact-registry";
import { LocalDocumentStore, contentHash } from "../packages/storage";
import { prisma } from "../packages/db/tenancy";
import { recomputeCompleteness } from "../packages/db/confirmation";
import { DEV_ORG_EMAIL } from "./dev-account";

const CREDENTIALS_FILE = path.join(process.cwd(), "test-credentials.txt");
const EMAIL = DEV_ORG_EMAIL;
const PASSWORD = "laboratoriya-2026";
const ORG_NAME = "ГО «Лабораторія культурних досліджень»";

/**
 * Documents the seeded citations quote from.
 *
 * Written out in full rather than referenced, because a citation whose quote
 * does not appear in the document it points at is the exact failure this
 * product exists to prevent — including in its own fixtures.
 */
const DOCUMENTS = [
  {
    kind: "STATUT" as const,
    filename: "statut-laboratoriya-kultury.txt",
    body: [
      "СТАТУТ",
      "ГРОМАДСЬКОЇ ОРГАНІЗАЦІЇ «ЛАБОРАТОРІЯ КУЛЬТУРНИХ ДОСЛІДЖЕНЬ»",
      "(тестовий документ, створений для демонстрації системи)",
      "",
      "1. ЗАГАЛЬНІ ПОЛОЖЕННЯ",
      "",
      "1.1. Громадська організація «Лабораторія культурних досліджень» (далі — Організація) " +
        "є непідприємницьким товариством, утвореним на основі єдності інтересів для спільної " +
        "реалізації її членами прав і свобод.",
      "",
      "1.2. Місцезнаходження Організації: місто Чернівці, Чернівецька область, Україна.",
      "",
      "1.3. Організація є неприбутковою організацією та внесена до Реєстру неприбуткових " +
        "установ та організацій. Доходи Організації використовуються виключно для " +
        "фінансування видатків на її утримання та реалізації статутної мети.",
      "",
      "2. МЕТА ТА НАПРЯМИ ДІЯЛЬНОСТІ",
      "",
      "2.1. Метою Організації є дослідження, збереження та популяризація культурної спадщини " +
        "Буковини, розвиток креативних індустрій та неформальної освіти у сфері культури.",
      "",
      "2.2. Основними напрямами діяльності Організації є:",
      "— організація експедицій буковинськими селами, документування звичаїв, ремесел та " +
        "локальної ідентичності;",
      "— проведення тренінгів з культурного менеджменту та маркетингу для соціальних ініціатив;",
      "— організація фестивалів, мистецьких та освітніх подій;",
      "— створення медіаконтенту та застосування технологій доповненої і віртуальної " +
        "реальності у культурних проєктах.",
      "",
      "2.3. Організація не здійснює видавничої діяльності та не є засновником засобів " +
        "масової інформації.",
      "",
    ].join("\n"),
  },
  {
    kind: "ANNUAL_REPORT" as const,
    filename: "richnyi-zvit-2025.txt",
    body: [
      "РІЧНИЙ ЗВІТ ЗА 2025 РІК",
      "ГО «Лабораторія культурних досліджень», Чернівці",
      "(тестовий документ, створений для демонстрації системи)",
      "",
      "ПРО КОМАНДУ",
      "",
      "Станом на 31 грудня 2025 року в Організації працювало 12 осіб, з яких 5 — на постійній " +
        "основі, решта — залучені на окремі проєкти координатори, дослідники та медіафахівці.",
      "",
      "КЛЮЧОВІ ПРОЄКТИ РОКУ",
      "",
      "Фестиваль «Лабораторія літератури» зібрав понад 1 400 відвідувачів у Чернівцях.",
      "",
      "Проведено чотири експедиції до сіл Сторожинецької та Вижницької громад; " +
        "оцифровано 217 предметів побуту та 39 годин аудіозаписів.",
      "",
      "МІЖНАРОДНА СПІВПРАЦЯ",
      "",
      "У межах проєкту «Спільна пам'ять» Організація вперше виступила партнером " +
        "румунської асоціації Asociația Culturală Bucovina; спільну заявку подано " +
        "та реалізовано протягом 2025 року.",
      "",
    ].join("\n"),
  },
];

/**
 * The profile.
 *
 * `state` is chosen per fact rather than uniformly, because the states are the
 * product. CONFIRMED facts carry a quote from a seeded document; SELF_REPORTED
 * facts are what the organization typed and nobody checked; is_publisher is
 * EXPLICIT_NEGATIVE, which is the only state that can ever license a hard
 * NOT_ELIGIBLE; the rest stay UNKNOWN.
 */
const FACTS: {
  key: string;
  state: "CONFIRMED" | "SELF_REPORTED" | "EXPLICIT_NEGATIVE";
  valueText: string;
  valueJson?: string[];
  confidence?: number;
  /** Index into DOCUMENTS, plus the sentence quoted from it. */
  citation?: { doc: number; quote: string };
}[] = [
  {
    key: "legal_form",
    state: "CONFIRMED",
    valueText: "Громадська організація (ГО)",
    confidence: 0.95,
    citation: {
      doc: 0,
      quote:
        "Громадська організація «Лабораторія культурних досліджень» (далі — Організація) є " +
        "непідприємницьким товариством, утвореним на основі єдності інтересів для спільної " +
        "реалізації її членами прав і свобод.",
    },
  },
  {
    key: "non_profit_status",
    state: "CONFIRMED",
    valueText: "так",
    confidence: 0.93,
    citation: {
      doc: 0,
      quote:
        "Організація є неприбутковою організацією та внесена до Реєстру неприбуткових " +
        "установ та організацій.",
    },
  },
  {
    key: "registration_oblast",
    state: "CONFIRMED",
    valueText: "Чернівецька область",
    confidence: 0.9,
    citation: {
      doc: 0,
      quote: "Місцезнаходження Організації: місто Чернівці, Чернівецька область, Україна.",
    },
  },
  {
    key: "sectors",
    state: "SELF_REPORTED",
    valueText: "культура; культурна спадщина; освіта; креативні індустрії; медіа",
    valueJson: ["культура", "культурна спадщина", "освіта", "креативні індустрії", "медіа"],
  },
  {
    key: "activity_areas",
    state: "SELF_REPORTED",
    valueText:
      "дослідження культурної спадщини; неформальна освіта; фестивалі та мистецькі події; " +
      "медіаконтент; технології доповненої та віртуальної реальності",
    valueJson: [
      "дослідження культурної спадщини",
      "неформальна освіта",
      "фестивалі та мистецькі події",
      "медіаконтент",
      "технології доповненої та віртуальної реальності",
    ],
  },
  {
    key: "geographic_coverage",
    state: "SELF_REPORTED",
    valueText: "Чернівці; Чернівецька область; Буковина",
    valueJson: ["Чернівці", "Чернівецька область", "Буковина"],
  },
  {
    key: "target_audiences",
    state: "SELF_REPORTED",
    valueText:
      "молодь; митці та культурні менеджери; мешканці сільських громад Буковини; " +
      "дослідники спадщини",
    valueJson: [
      "молодь",
      "митці та культурні менеджери",
      "мешканці сільських громад Буковини",
      "дослідники спадщини",
    ],
  },
  {
    key: "team_size",
    state: "SELF_REPORTED",
    valueText: "7",
  },
  {
    key: "previous_donors",
    state: "SELF_REPORTED",
    valueText: "Український культурний фонд; House of Europe",
    valueJson: ["Український культурний фонд", "House of Europe"],
  },
  {
    // The one state that can license a hard NOT_ELIGIBLE. Without a fact like
    // this in the fixture, every rejection in a demo would be a guess.
    key: "is_publisher",
    state: "EXPLICIT_NEGATIVE",
    valueText: "ні",
    citation: {
      doc: 0,
      quote:
        "Організація не здійснює видавничої діяльності та не є засновником засобів " +
        "масової інформації.",
    },
  },
];

/**
 * Proposals waiting in the confirmation queue.
 *
 * One of them contradicts a self-reported value on purpose: the report says 12
 * people, the profile says 7. That is the case the queue exists for, and a demo
 * where every proposal simply agrees with the profile never shows it.
 */
const CANDIDATES: {
  key: string;
  doc: number;
  valueText: string;
  quote: string;
  confidence: number;
}[] = [
  {
    key: "team_size",
    doc: 1,
    valueText: "12",
    quote:
      "Станом на 31 грудня 2025 року в Організації працювало 12 осіб, з яких 5 — на постійній " +
      "основі, решта — залучені на окремі проєкти координатори, дослідники та медіафахівці.",
    confidence: 0.82,
  },
  {
    key: "international_project_experience",
    doc: 1,
    valueText: "так",
    quote:
      "У межах проєкту «Спільна пам'ять» Організація вперше виступила партнером " +
      "румунської асоціації Asociația Culturală Bucovina; спільну заявку подано " +
      "та реалізовано протягом 2025 року.",
    confidence: 0.88,
  },
  {
    key: "international_partners",
    doc: 1,
    valueText: "Asociația Culturală Bucovina (Румунія)",
    quote:
      "Організація вперше виступила партнером румунської асоціації Asociația Culturală Bucovina",
    confidence: 0.71,
  },
];

/** An index into DOCUMENTS that is out of range is a typo in this file, not a null. */
function documentAt(index: number): (typeof DOCUMENTS)[number] {
  const doc = DOCUMENTS[index];
  if (!doc) throw new Error(`no seeded document at index ${index}`);
  return doc;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "seed-demo-org creates an account with a known password — refusing to run in production",
    );
  }

  // Every seeded quote must actually occur in the document it cites. This is the
  // product's own rule applied to its fixtures; a fixture that violates it would
  // teach the wrong thing about what a citation means.
  for (const fact of FACTS) {
    if (fact.citation && !documentAt(fact.citation.doc).body.includes(fact.citation.quote)) {
      throw new Error(`citation for ${fact.key} does not occur in the document it points at`);
    }
  }
  for (const candidate of CANDIDATES) {
    if (!documentAt(candidate.doc).body.includes(candidate.quote)) {
      throw new Error(`candidate quote for ${candidate.key} does not occur in its document`);
    }
  }

  const passwordHash = await hashPassword(PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    create: { email: EMAIL, passwordHash, displayName: "Лабораторія культури" },
    update: { passwordHash },
  });

  let membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: { organization: true },
  });

  if (!membership) {
    const organization = await prisma.organization.create({
      data: {
        name: ORG_NAME,
        nameEn: "Laboratory of Cultural Research",
        legalForm: "GROMADSKA_ORGANIZATSIYA",
        nonProfitStatus: true,
        oblast: "Чернівецька область",
        city: "Чернівці",
      },
    });
    membership = await prisma.membership.findFirstOrThrow({
      where: {
        id: (
          await prisma.membership.create({
            data: { userId: user.id, organizationId: organization.id, role: "OWNER" },
          })
        ).id,
      },
      include: { organization: true },
    });
  }

  const organizationId = membership.organizationId;
  const now = new Date();

  // Rebuild rather than patch. A half-updated fixture is harder to reason about
  // than a rebuilt one, and nothing here is anyone's real data.
  await prisma.factCandidate.deleteMany({ where: { organizationId } });
  await prisma.organizationFact.deleteMany({ where: { organizationId } });

  const store = new LocalDocumentStore();
  const documentIds: string[] = [];
  const documentIdAt = (index: number): string => {
    const id = documentIds[index];
    if (!id) throw new Error(`no stored document at index ${index}`);
    return id;
  };

  for (const spec of DOCUMENTS) {
    const bytes = new TextEncoder().encode(spec.body);
    const hash = contentHash(bytes);

    const existing = await prisma.document.findUnique({
      where: { organizationId_contentHash: { organizationId, contentHash: hash } },
    });
    if (existing) {
      documentIds.push(existing.id);
      continue;
    }

    const stored = await store.put(organizationId, spec.filename, bytes);
    const document = await prisma.document.create({
      data: {
        organizationId,
        kind: spec.kind,
        filename: spec.filename,
        storageKey: stored.key,
        mimeType: "text/plain",
        sizeBytes: stored.sizeBytes,
        contentHash: hash,
        extractedAt: now,
      },
    });
    documentIds.push(document.id);
  }

  const answered = new Set(FACTS.map((f) => f.key));
  for (const key of FACT_KEYS) {
    const spec = FACTS.find((f) => f.key === key);

    if (!spec) {
      // An UNKNOWN row, not an absent one. See D4: absence is a stored state.
      await prisma.organizationFact.create({
        data: { organizationId, key, state: "UNKNOWN" },
      });
      continue;
    }

    await prisma.organizationFact.create({
      data: {
        organizationId,
        key,
        state: spec.state,
        valueText: spec.valueText,
        valueJson: spec.valueJson ?? undefined,
        confidence: spec.confidence ?? null,
        confirmedByUserId: spec.state === "CONFIRMED" ? user.id : null,
        confirmedAt: spec.state === "CONFIRMED" ? now : null,
        citations: spec.citation
          ? {
              create: [
                {
                  quote: spec.citation.quote,
                  page: 1,
                  retrievedAt: now,
                  documentId: documentIdAt(spec.citation.doc),
                },
              ],
            }
          : undefined,
      },
    });
  }

  for (const spec of CANDIDATES) {
    await prisma.factCandidate.create({
      data: {
        organizationId,
        documentId: documentIdAt(spec.doc),
        key: spec.key,
        state: "SELF_REPORTED",
        valueText: spec.valueText,
        quote: spec.quote,
        page: 1,
        confidence: spec.confidence,
        status: "PENDING",
      },
    });
  }

  await prisma.auditEntry.create({
    data: {
      organizationId,
      actorType: "SYSTEM",
      actorId: "seed-demo-org",
      action: "organization.seeded",
      subjectType: "Organization",
      subjectId: organizationId,
      toState: "ACTIVE",
    },
  });

  const completeness = await recomputeCompleteness(organizationId);

  if (!existsSync(CREDENTIALS_FILE)) {
    writeFileSync(
      CREDENTIALS_FILE,
      [
        "Тестовий обліковий запис Grant Assistant",
        "",
        `Пошта:  ${EMAIL}`,
        `Пароль: ${PASSWORD}`,
        `Вхід:   http://localhost:3000/vhid`,
        "",
        `Організація: ${ORG_NAME}`,
        "",
        "Цей файл у .gitignore. Обліковий запис створює scripts/seed-demo-org.ts",
        "і він призначений лише для локальної розробки.",
        "",
      ].join("\n"),
      "utf8",
    );
  }

  console.log(`user          ${EMAIL}`);
  console.log(`password      ${PASSWORD}   (also in test-credentials.txt)`);
  console.log(`organization  ${ORG_NAME}`);
  console.log(`documents     ${documentIds.length}`);
  console.log(
    `facts         ${answered.size} answered / ${FACT_KEYS.length} keys` +
      `  → ${Math.round(completeness * 100)}% complete`,
  );
  console.log(`  confirmed   ${FACTS.filter((f) => f.state === "CONFIRMED").length}`);
  console.log(`  self-rep.   ${FACTS.filter((f) => f.state === "SELF_REPORTED").length}`);
  console.log(`  neg.        ${FACTS.filter((f) => f.state === "EXPLICIT_NEGATIVE").length}`);
  console.log(`  unknown     ${FACT_KEYS.length - answered.size}   (left unanswered on purpose)`);
  console.log(`candidates    ${CANDIDATES.length} pending in the queue`);
  console.log(`\nsign in at    http://localhost:3000/vhid\n`);
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
