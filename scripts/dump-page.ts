/**
 * Dump the rendered text of a signed-in page, to read what a user would see.
 *
 *   npx tsx scripts/dump-page.ts /profil [email]
 *
 * Tags are stripped rather than kept: the question this answers is "does the
 * page say the right things", and markup makes that harder to see, not easier.
 */

import { createSession, SESSION_COOKIE } from "../packages/auth/session";
import { prisma } from "../packages/db/tenancy";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

function toText(html: string): string {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  return body
    .replace(/<\/(p|div|section|li|tr|h[1-6]|dt|dd|label|button)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

async function main(): Promise<void> {
  const path = process.argv[2] ?? "/profil";
  const email = process.argv[3] ?? process.env.SMOKE_EMAIL ?? "laboratoryofculture@gmail.com";

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`no such user: ${email}`);

  const { token } = await createSession(user.id);
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
    redirect: "manual",
  });

  console.log(`${path} → ${res.status}\n`);
  if (res.status !== 200) {
    console.log(`redirected to ${res.headers.get("location")}`);
    return;
  }
  console.log(toText(await res.text()));
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
