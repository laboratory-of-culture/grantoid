/**
 * A second test organization, with nothing filled in.
 *
 *   npx tsx scripts/seed-empty-org.ts
 *
 * The demo organization answers ten of eighteen questions, which is the case
 * the product was tuned against. A brand-new one answers none, and that is the
 * harder case in every direction:
 *
 *   - Eligibility must return UNCERTAIN everywhere rather than guessing, and
 *     must never collapse an unanswered field into a NO (D4).
 *   - The concept writer has no facts to compose from, which is exactly when a
 *     model invents them. A draft for this organization that names a team size
 *     or a partner is a bug with a name.
 *
 * Registers through the same `register()` the sign-up form calls, so the row
 * shapes are the ones a real account gets — including the UNKNOWN fact row per
 * registry key, which is the whole point.
 *
 * Refuses to run against production, like every other seed here. The password
 * is generated rather than fixed, and written to the same gitignored file.
 */

import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { register, RegistrationFailed } from "../packages/auth/accounts";
import { prisma } from "../packages/db/tenancy";

const CREDENTIALS_FILE = path.join(process.cwd(), "test-credentials.txt");

const EMAIL = "syla.rukhu@example.org";
const NAME = "ГО «Сила Руху»";

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("refusing to seed a known account into production");
  }

  const existing = await prisma.user.findUnique({
    where: { email: EMAIL },
    include: { memberships: { include: { organization: true } } },
  });
  if (existing) {
    const org = existing.memberships[0]?.organization;
    const answered = await prisma.organizationFact.count({
      where: { organizationId: org?.id, state: { not: "UNKNOWN" } },
    });
    console.log(`already seeded: ${org?.name} — ${answered} answered facts`);
    console.log(`password is in ${path.basename(CREDENTIALS_FILE)} from the first run`);
    return;
  }

  // Generated, not fixed: a script that writes a known password into a file is
  // one thing, a script that hard-codes the same one in the repository is
  // another.
  const password = `syla-${randomBytes(6).toString("hex")}`;

  let created: { userId: string; organizationId: string };
  try {
    created = await register({
      email: EMAIL,
      password,
      organizationName: NAME,
      displayName: "Тестовий менеджер",
    });
  } catch (err) {
    if (err instanceof RegistrationFailed) throw new Error(err.message);
    throw err;
  }

  const rows = await prisma.organizationFact.count({
    where: { organizationId: created.organizationId },
  });
  const answered = await prisma.organizationFact.count({
    where: { organizationId: created.organizationId, state: { not: "UNKNOWN" } },
  });

  // The assertion the fixture exists for. An empty profile means every registry
  // key has a row and every row is UNKNOWN — not that the rows are absent,
  // which is a different state the validator rejects outright.
  if (answered !== 0) {
    throw new Error(`expected an empty profile, found ${answered} answered facts`);
  }

  const block =
    `\n${NAME}\n` +
    `  сторінка входу  http://localhost:3000/vhid\n` +
    `  пошта           ${EMAIL}\n` +
    `  пароль          ${password}\n` +
    `  профіль         0 з ${rows} полів заповнено — навмисно порожній\n`;

  if (!existsSync(CREDENTIALS_FILE) || !readFileSync(CREDENTIALS_FILE, "utf8").includes(EMAIL)) {
    appendFileSync(CREDENTIALS_FILE, block, "utf8");
  }

  console.log(`${NAME} created`);
  console.log(`  ${EMAIL} / ${password}`);
  console.log(`  ${rows} fact rows, all UNKNOWN`);
  console.log(`  written to ${path.basename(CREDENTIALS_FILE)} (gitignored)`);
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
