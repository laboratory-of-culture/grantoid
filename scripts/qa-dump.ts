/**
 * Render every screen and print it as text, for reading through in one pass.
 *
 *   npx tsx scripts/qa-dump.ts
 *
 * Not a substitute for looking at the pixels. It is the half of a UI review that
 * can be done without a browser — labels, states, empty cases, dead ends — and
 * it is the half that has found every content bug in this product so far.
 */

import { createSession, SESSION_COOKIE } from "../packages/auth/session";
import { prisma } from "../packages/db/tenancy";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

function toText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(p|div|section|li|tr|h[1-6]|dt|dd|label|button|summary|article)>/gi, "\n")
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
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

async function tokenFor(email: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return (await createSession(user.id)).token;
}

async function dump(label: string, path: string, token: string | null): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
    redirect: "manual",
  });

  console.log(`\n${"=".repeat(78)}`);
  console.log(`${label}   ${path}   → ${res.status}`);
  console.log("=".repeat(78));

  if (res.status !== 200) {
    console.log(`redirect → ${res.headers.get("location")}`);
    return;
  }
  console.log(toText(await res.text()));
}

/**
 * A token that really exists, so the good path is checked as well as the bad.
 *
 * The two states looked identical until a read-through caught it, and a screen
 * that says the same thing whatever happened is one nobody can trust.
 */
async function validToken(): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { unsubscribeToken: { not: null } },
    select: { unsubscribeToken: true },
  });
  return user?.unsubscribeToken ?? "none-issued-yet";
}

async function main(): Promise<void> {
  const ngo = await tokenFor("laboratoryofculture@gmail.com");
  const admin = await tokenFor("admin@grant-assistant.local");

  const grant = await prisma.match.findFirst({
    orderBy: [{ recommend: "desc" }, { matchScore: "desc" }],
    select: { grantId: true },
  });
  const gid = grant?.grantId ?? "none";

  await dump("ВХІД", "/vhid", null);
  await dump("РЕЄСТРАЦІЯ", "/reyestratsiya", null);
  await dump("ПРИВАТНІСТЬ", "/pryvatnist", null);
  await dump("ВІДПИСКА (поганий токен)", "/vidpyska?t=nonsense", null);
  await dump("ПРОФІЛЬ", "/profil", ngo);
  await dump("СТРІЧКА", "/mozhlyvosti", ngo);
  await dump("ЗАЯВКИ", "/zayavky", ngo);
  await dump("ВІДПИСКА (дійсний токен)", "/vidpyska?t=" + (await validToken()), null);
  await dump("ГРАНТ", `/hranty/${gid}`, ngo);
  await dump("РЕДАКТОР", `/hranty/${gid}/redaktor`, ngo);
  await dump("ДЖЕРЕЛА (адмін)", "/dzherela", admin);
  await dump("ГРАНТ, якого немає", "/hranty/does-not-exist", ngo);
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
