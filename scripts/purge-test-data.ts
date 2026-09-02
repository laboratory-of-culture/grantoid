/**
 * Remove everything that exists only so developers could see the product work.
 *
 *   npx tsx scripts/purge-test-data.ts            # report, change nothing
 *   npx tsx scripts/purge-test-data.ts --delete   # actually remove it
 *
 * Dry by default, and deliberately so. This deletes organizations with their
 * documents and drafts, and a script that does that on a bare invocation is one
 * somebody eventually runs in the wrong terminal.
 *
 * What counts as test data, and why each one:
 *
 *   - **Synthetic grants.** Hand-authored fixtures. `Grant.synthetic` marks
 *     them, the feed labels them, and the digest refuses to mail them. They
 *     have no place in a live database.
 *   - **Fixture organizations.** The eval set in `evals/fixtures/orgs` is loaded
 *     into the database to run the golden set. Matched by name against the
 *     fixture files rather than a hard-coded list, so adding a fixture does not
 *     silently leave one behind.
 *   - **Seeded demo organizations.** Created by `seed:demo` and
 *     `seed-empty-org` with known passwords written to a text file. A known
 *     password on a public host is a break-in, not a demo.
 *
 * What it never touches: the operator account, live grants, and the source
 * registry. Those are the things a fresh install needs to work.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "../packages/db/tenancy";
import { documentStore } from "../packages/db/documents";
import { DEV_ORG_EMAIL } from "./dev-account";

const APPLY = process.argv.includes("--delete");

/**
 * Domains that cannot belong to a real person.
 *
 * RFC 2606 reserves these precisely so nobody has to guess. Any account on one
 * was created by a script, and the rule keeps working when somebody adds a
 * smoke-test organization nobody remembers to list here. It found one already:
 * «Громадська організація «Веселка»» belongs to veselka.smoke@example.org and
 * appears in no fixture file and no seed script anybody could grep for.
 */
const RESERVED_DOMAINS = [
  "@example.com",
  "@example.net",
  "@example.org",
  ".test",
  ".invalid",
  ".example",
];

/**
 * The account `seed:demo` creates.
 *
 * Its default is on a reserved domain, so the rule above already finds it and
 * this list is redundant in the normal case. It is not redundant when somebody
 * points DEV_ORG_EMAIL at a working address to make a demo look real — then
 * this is the only thing that recognises the account, and its password is
 * sitting in test-credentials.txt.
 *
 * The reason it reads an environment variable rather than naming an address:
 * the operator's own NGO is also a beta user, and while the demo account
 * shared its address, `--delete` on a live server would have taken the real
 * organization's profile and documents with it.
 */
const SEEDED_EMAILS = [DEV_ORG_EMAIL];

/**
 * Fixture organization names, read from the eval files rather than listed here.
 *
 * A hard-coded list goes stale the first time somebody adds a fixture, and the
 * failure is silent: the new one stays in production looking like a real NGO.
 */
function fixtureOrgNames(): string[] {
  const dir = path.join(process.cwd(), "evals", "fixtures", "orgs");
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  } catch {
    return [];
  }

  return files.flatMap((file) => {
    const text = readFileSync(path.join(dir, file), "utf8");
    // The fixtures are small and the field is at the top level; a YAML parser
    // would be a dependency for one line.
    const match = /^name:\s*["']?(.+?)["']?\s*$/m.exec(text);
    return match?.[1] ? [match[1]] : [];
  });
}

async function main(): Promise<void> {
  const fixtures = fixtureOrgNames();
  console.log(
    fixtures.length > 0
      ? `фікстури оцінювання: ${fixtures.join(", ")}`
      : "фікстур оцінювання не знайдено (evals/fixtures/orgs порожня)",
  );

  const seededUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: SEEDED_EMAILS } },
        ...RESERVED_DOMAINS.map((d) => ({ email: { contains: d } })),
      ],
    },
    include: { memberships: { include: { organization: { select: { id: true, name: true } } } } },
  });
  console.log(
    seededUsers.length > 0
      ? `тестові облікові записи: ${seededUsers.map((u) => u.email).join(", ")}`
      : "тестових облікових записів не знайдено",
  );
  const seededOrgIds = seededUsers.flatMap((u) => u.memberships.map((m) => m.organizationId));

  const orgs = await prisma.organization.findMany({
    where: { OR: [{ name: { in: fixtures } }, { id: { in: seededOrgIds } }] },
    select: {
      id: true,
      name: true,
      _count: { select: { documents: true, concepts: true, matches: true, memberships: true } },
    },
    orderBy: { name: "asc" },
  });

  const syntheticGrants = await prisma.grant.count({ where: { synthetic: true } });

  console.log("\nдо видалення:");
  for (const o of orgs) {
    console.log(
      `  ${o.name.padEnd(46)} документів ${o._count.documents}, ` +
        `концепцій ${o._count.concepts}, оцінок ${o._count.matches}, ` +
        `користувачів ${o._count.memberships}`,
    );
  }
  console.log(`  синтетичних конкурсів: ${syntheticGrants}`);

  const stayingOrgs = await prisma.organization.count();
  const stayingGrants = await prisma.grant.count({ where: { synthetic: false } });
  console.log(
    `\nлишиться: організацій ${stayingOrgs - orgs.length}, живих конкурсів ${stayingGrants}`,
  );

  if (!APPLY) {
    console.log("\nнічого не видалено. Щоб видалити, додайте --delete");
    return;
  }

  // Files first, then rows.
  //
  // The reverse order leaves orphans nobody can find: once the Document row is
  // gone, nothing points at the blob on disk. An orphaned row with a missing
  // file is the recoverable failure; a file nobody references is not.
  const store = documentStore();
  for (const org of orgs) {
    const docs = await prisma.document.findMany({
      where: { organizationId: org.id },
      select: { storageKey: true },
    });
    for (const doc of docs) {
      await store.delete(doc.storageKey).catch((err) => {
        console.error(`  файл ${doc.storageKey} не видалено: ${String(err).slice(0, 80)}`);
      });
    }
  }

  const removedOrgs = await prisma.organization.deleteMany({
    where: { id: { in: orgs.map((o) => o.id) } },
  });
  // Users are not cascaded by the organization: a person can outlive the
  // organization they belonged to. These particular ones are seed accounts with
  // published passwords, so they go too.
  const removedUsers = await prisma.user.deleteMany({
    where: { id: { in: seededUsers.map((u) => u.id) } },
  });
  const removedGrants = await prisma.grant.deleteMany({ where: { synthetic: true } });

  console.log(
    `\nвидалено: організацій ${removedOrgs.count}, користувачів ${removedUsers.count}, ` +
      `синтетичних конкурсів ${removedGrants.count}`,
  );
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
