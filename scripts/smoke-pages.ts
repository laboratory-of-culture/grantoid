/**
 * Fetch every signed-in route against a running dev server and report the status.
 *
 *   npm run dev
 *   npx tsx scripts/smoke-pages.ts
 *
 * The session is minted directly rather than by posting the sign-in form: this
 * checks that the pages render for a logged-in user, which is a different
 * question from whether the login form works, and mixing the two makes a failure
 * ambiguous.
 *
 * Not a substitute for the Playwright suite — this is the thirty-second check
 * that nothing throws before someone clicks around by hand.
 */

import { createSession, SESSION_COOKIE } from "../packages/auth/session";
import { prisma } from "../packages/db/tenancy";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.SMOKE_EMAIL ?? "laboratoryofculture@gmail.com";

type Route = { path: string; auth: boolean; expect?: string[] };

/**
 * What to fetch depends on who is signed in, because the two account kinds are
 * meant to see different things: an NGO member has a profile and no source
 * registry, the operator has a registry and no organization. Hard-coding one
 * list makes the correct redirect for the other account look like a failure —
 * which it did, the first time this ran.
 *
 * `expect` guards against the page that returns 200 and renders nothing useful:
 * a query that silently found no rows looks identical to a healthy page until
 * someone reads it.
 */
function routesFor(orgName: string | null, isAdmin: boolean): Route[] {
  return [
    { path: "/", auth: false },
    { path: "/vhid", auth: false, expect: ["Електронна пошта", "Пароль"] },
    { path: "/reyestratsiya", auth: false, expect: ["Назва організації"] },
    {
      path: "/profil",
      auth: true,
      // Redirects for an account with no organization; renders the org's own
      // name for one that has it. The two state labels are checked because the
      // page rendering at all is a weaker claim than the page rendering the
      // distinction the product is built on.
      expect: orgName ? [orgName, "Підтверджено", "Зі слів організації"] : undefined,
    },
    {
      path: "/dzherela",
      auth: true,
      expect: isAdmin ? ["Ресурсний центр ГУРТ", "Громадський Простір"] : undefined,
    },
  ];
}

async function main(): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
    include: { memberships: { include: { organization: true } } },
  });
  if (!user) throw new Error(`no such user: ${EMAIL} — run npm run seed:demo first`);

  const orgName = user.memberships[0]?.organization.name ?? null;
  const ROUTES = routesFor(orgName, user.isAdmin);
  console.log(
    `signed in as ${EMAIL}${user.isAdmin ? " (admin)" : ""}` +
      `${orgName ? ` — ${orgName}` : " — no organization"}\n`,
  );

  const { token } = await createSession(user.id);
  let failures = 0;

  for (const route of ROUTES) {
    const res = await fetch(`${BASE}${route.path}`, {
      headers: route.auth ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
      redirect: "manual",
    });

    const body = res.status === 200 ? await res.text() : "";
    // Next renders an error boundary with a 200 in dev, so the status alone is
    // not enough to call a page healthy.
    const brokeInPlace = body.includes("__next_error__") || body.includes("Application error");
    const missing = (route.expect ?? []).filter((needle) => !body.includes(needle));
    const ok =
      ((res.status === 200 && !brokeInPlace) || res.status === 307 || res.status === 302) &&
      missing.length === 0;

    if (!ok) failures += 1;
    const label = brokeInPlace
      ? `${res.status} (error boundary)`
      : missing.length > 0
        ? `${res.status} — missing: ${missing.join(", ")}`
        : String(res.status);
    console.log(`${ok ? "ok  " : "FAIL"} ${route.path.padEnd(16)} ${label}`);
  }

  console.log(failures === 0 ? "\nall routes render\n" : `\n${failures} route(s) broken\n`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
