/**
 * One-time setup: the admin account and the two grant sources.
 *
 *   npx tsx scripts/setup-sources.ts
 *
 * Idempotent. Re-running keeps the existing admin password rather than issuing
 * a new one — a script that silently rotates a credential is one nobody dares
 * re-run.
 */

import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

import { hashPassword } from "../packages/auth/password";
import { DEFAULT_USER_AGENT } from "../packages/ingestion/fetch";
import { monitorSource, reviewRobots } from "../packages/ingestion/monitor";
import { prisma } from "../packages/db/tenancy";

const CREDENTIALS_FILE = path.join(process.cwd(), "admin-credentials.txt");
const ADMIN_EMAIL = "admin@grant-assistant.local";

/**
 * Both sources were checked by hand before being written here.
 *
 * Громадський Простір runs WordPress and exposes its opportunities as a custom
 * post type, so the feed is the post-type feed rather than the site feed — the
 * site feed mixes in everything else it publishes.
 *
 * ГУРТ publishes no feed at all. /rss/, /feed/ and /rss.xml all 404, the
 * sitemaps.xml its robots.txt names is gone, and the "rss" icon on the site
 * links to a WhatsApp channel. Its listing page is parsed instead, which its
 * robots.txt permits.
 */
const SOURCES = [
  {
    name: "Громадський Простір",
    homepageUrl: "https://www.prostir.ua",
    kind: "AGGREGATOR" as const,
    discovery: "RSS" as const,
    discoveryUrl: "https://www.prostir.ua/?post_type=grants&feed=rss2",
    contactEmail: "info@prostir.ua",
    tosNote:
      "robots.txt забороняє лише /wp-admin/. Умови використання окремою сторінкою не опубліковані; " +
      "матеріали є публічними анонсами можливостей. Зберігаємо лише заголовок, посилання та дату, " +
      "повний текст не републікуємо.",
    crawlCadenceHours: 6,
    rateLimitPerMin: 6,
  },
  {
    name: "Ресурсний центр ГУРТ",
    homepageUrl: "https://gurt.org.ua",
    kind: "AGGREGATOR" as const,
    discovery: "HTML_LIST" as const,
    discoveryUrl: "https://gurt.org.ua/news/grants/",
    contactEmail: "gurt@gurt.org.ua",
    tosNote:
      "robots.txt не обмежує обхід (порожній Disallow для всіх). RSS відсутній — розбираємо список " +
      "оголошень. Зберігаємо лише заголовок і посилання, повний текст не републікуємо.",
    crawlCadenceHours: 6,
    rateLimitPerMin: 4,
  },
];

async function ensureAdmin(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { isAdmin: true } });
    console.log(`admin      ${ADMIN_EMAIL} (already exists, password unchanged)`);
    if (!existsSync(CREDENTIALS_FILE)) {
      console.log(
        "\n  The credentials file is missing and the password cannot be recovered from\n" +
          "  the hash. Delete the admin user and re-run to issue a new one.\n",
      );
    }
    return;
  }

  // 24 bytes of base64url: long enough that the length rule is irrelevant and
  // there is nothing to guess.
  const password = randomBytes(24).toString("base64url");
  const user = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash: await hashPassword(password),
      displayName: "Адміністратор",
      isAdmin: true,
    },
  });

  // The admin has no organization: the source registry belongs to nobody's NGO.
  // A membership would put a real organization's data one click away from an
  // operator account, which is not a boundary worth blurring.
  writeFileSync(
    CREDENTIALS_FILE,
    [
      "Grant Assistant — обліковий запис адміністратора",
      "",
      `Пошта:  ${ADMIN_EMAIL}`,
      `Пароль: ${password}`,
      "",
      `Створено: ${new Date().toISOString()}`,
      `ID:       ${user.id}`,
      "",
      "Цей файл у .gitignore і ніколи не потрапляє в репозиторій.",
      "Пароль зберігається лише тут — у базі лежить його scrypt-хеш, відновити його звідти",
      "неможливо. Втратите файл — видаліть користувача та запустіть скрипт знову.",
      "",
      "Адміністратор не належить до жодної організації: реєстр джерел не є чиїмось НУО,",
      "і членство зробило б дані реальної організації доступними операторському акаунту.",
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(`admin      ${ADMIN_EMAIL} created`);
  console.log(`           credentials written to ${path.basename(CREDENTIALS_FILE)}`);
}

async function ensureSources(): Promise<void> {
  for (const spec of SOURCES) {
    const source = await prisma.source.upsert({
      where: { homepageUrl: spec.homepageUrl },
      create: {
        name: spec.name,
        homepageUrl: spec.homepageUrl,
        kind: spec.kind,
        discovery: spec.discovery,
        discoveryUrl: spec.discoveryUrl,
        userAgent: DEFAULT_USER_AGENT,
        contactEmail: spec.contactEmail,
        tosNote: spec.tosNote,
        tosReviewedAt: new Date(),
        crawlCadenceHours: spec.crawlCadenceHours,
        rateLimitPerMin: spec.rateLimitPerMin,
        enabled: false,
      },
      update: {
        discovery: spec.discovery,
        discoveryUrl: spec.discoveryUrl,
        userAgent: DEFAULT_USER_AGENT,
        contactEmail: spec.contactEmail,
        tosNote: spec.tosNote,
        tosReviewedAt: new Date(),
        crawlCadenceHours: spec.crawlCadenceHours,
        rateLimitPerMin: spec.rateLimitPerMin,
      },
    });

    const robots = await reviewRobots(source.id);
    console.log(`source     ${spec.name}`);
    console.log(`           robots: ${robots.allowed ? "дозволено" : "ЗАБОРОНЕНО"} — ${robots.note}`);

    if (!robots.allowed) {
      console.log("           left disabled\n");
      continue;
    }

    await prisma.source.update({ where: { id: source.id }, data: { enabled: true } });
    console.log(`           enabled, ${spec.discovery} → ${spec.discoveryUrl}\n`);
  }
}

async function main(): Promise<void> {
  await ensureAdmin();
  console.log("");
  await ensureSources();

  console.log("first check\n");
  for (const source of await prisma.source.findMany({ where: { enabled: true } })) {
    const result = await monitorSource(source.id);
    if (result.error) {
      console.log(`  ${result.sourceName}: ПОМИЛКА — ${result.error}`);
      continue;
    }
    console.log(
      `  ${result.sourceName}: знайдено ${result.found}, нових ${result.added}, ` +
        `змінених ${result.changed}, без змін ${result.unchanged} ` +
        `(${(result.durationMs / 1000).toFixed(1)}с)`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
