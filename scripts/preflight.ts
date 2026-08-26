/**
 * The launch checklist, run rather than read.
 *
 *   npx tsx scripts/preflight.ts
 *
 * `docs/DEPLOY.md` ends with a list of boxes to tick. A list nobody can execute
 * gets ticked from memory, so this checks the ones a machine can settle and
 * exits non-zero when any of them fails. What it cannot check it says out loud
 * rather than passing over in silence.
 *
 * Safe to run against production: every check is a read.
 */

import { existsSync } from "node:fs";
import path from "node:path";

import { prisma } from "../packages/db/tenancy";

type Check = {
  name: string;
  /** null when the check could not run rather than when it failed. */
  ok: boolean | null;
  detail: string;
};

const checks: Check[] = [];

function record(name: string, ok: boolean | null, detail: string): void {
  checks.push({ name, ok, detail });
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? "";

  // Prisma sizes its pool at cores*2+1 per process and this deployment runs
  // several. Without a limit a working day reaches Postgres's default 100, and
  // the symptom is not an application error but tests silently skipping.
  record(
    "DATABASE_URL має connection_limit",
    url.includes("connection_limit="),
    url.includes("connection_limit=")
      ? `є: ${/connection_limit=(\d+)/.exec(url)?.[1] ?? "?"}`
      : "додайте ?connection_limit=5 до рядка підключення",
  );

  record(
    "пароль бази не з прикладу",
    !url.includes("grant:grant@"),
    url.includes("grant:grant@")
      ? "у рядку підключення стоїть пароль із .env.example"
      : "змінено",
  );

  const base = process.env.APP_BASE_URL ?? "";
  record(
    "APP_BASE_URL — справжній домен",
    base.startsWith("https://") && !base.includes("localhost"),
    base === "" ? "не задано" : base,
  );

  // Written by setup-sources.ts and seed:demo. Both are gitignored, and both
  // contain a working password in plain text.
  for (const file of ["admin-credentials.txt", "test-credentials.txt"]) {
    const present = existsSync(path.join(process.cwd(), file));
    record(`${file} прибрано з сервера`, !present, present ? "файл на місці" : "відсутній");
  }

  // Development-only, served from public/, and gitignored. Its presence in a
  // deployed tree means someone copied the directory rather than checked it out.
  const audit = existsSync(path.join(process.cwd(), "public", "_audit.js"));
  record("public/_audit.js відсутній", !audit, audit ? "інструмент аудиту в public/" : "відсутній");

  const font = existsSync(path.join(process.cwd(), "public", "fonts", "inter-variable.woff2"));
  record(
    "шрифт на місці",
    font,
    font ? "inter-variable.woff2" : "без нього інтерфейс піде системним гротеском",
  );

  try {
    const synthetic = await prisma.grant.count({ where: { synthetic: true } });
    record(
      "синтетичних конкурсів немає",
      synthetic === 0,
      synthetic === 0 ? "нуль" : `${synthetic} — запустіть purge-test-data.ts --delete`,
    );

    const testUsers = await prisma.user.count({
      where: {
        OR: [
          { email: { contains: "@example." } },
          { email: { contains: ".test" } },
          { email: { contains: ".invalid" } },
        ],
      },
    });
    record(
      "тестових облікових записів немає",
      testUsers === 0,
      testUsers === 0 ? "нуль" : `${testUsers} на зарезервованих доменах`,
    );

    const admins = await prisma.user.count({ where: { isAdmin: true } });
    record(
      "є операторський обліковий запис",
      admins > 0,
      admins > 0 ? `${admins}` : "нікому відкрити реєстр джерел",
    );

    const enabled = await prisma.source.count({ where: { enabled: true } });
    const unreviewed = await prisma.source.count({
      where: { enabled: true, robotsCheckedAt: null },
    });
    record(
      "увімкнені джерела перевірені на robots.txt",
      unreviewed === 0,
      unreviewed === 0 ? `${enabled} увімкнено` : `${unreviewed} без перевірки robots.txt`,
    );

    const orgs = await prisma.organization.count();
    const grants = await prisma.grant.count({ where: { synthetic: false } });
    record("дані на місці", null, `організацій ${orgs}, живих конкурсів ${grants}`);
  } catch (err) {
    record("база доступна", false, String(err).replace(/\s+/g, " ").slice(0, 90));
  }

  const failed = checks.filter((c) => c.ok === false);

  console.log("");
  for (const c of checks) {
    const mark = c.ok === null ? "  " : c.ok ? "ok" : "!!";
    console.log(`${mark}  ${c.name.padEnd(44)} ${c.detail}`);
  }

  // Named rather than skipped. A checklist that lists only what it can prove
  // teaches an operator that everything else is done.
  console.log("\nперевірте вручну:");
  console.log("  · порт 5432 недоступний ззовні (спробуйте з іншої машини)");
  console.log("  · TLS працює і HTTP перенаправляє на HTTPS");
  console.log("  · cron відпрацював повний нічний цикл без помилок у логах");
  console.log("  · резервна копія бази знімається і відновлюється");

  console.log(
    failed.length === 0
      ? "\nавтоматичні перевірки пройдено\n"
      : `\n${failed.length} перевірок не пройдено\n`,
  );
  if (failed.length > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
