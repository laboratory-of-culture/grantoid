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

type Route = {
  path: string;
  auth: boolean;
  expect?: string[];
  /**
   * Where a redirect must land. Checked because the first version of this script
   * accepted any 307 as healthy, and so reported the operator account bouncing
   * from /profil back to the login form as a passing route.
   */
  redirectsTo?: string;
};

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
  const home = orgName ? "/profil" : isAdmin ? "/dzherela" : "/vhid";

  return [
    { path: "/", auth: true, redirectsTo: home },
    { path: "/vhid", auth: false, expect: ["Електронна пошта", "Пароль"] },
    { path: "/reyestratsiya", auth: false, expect: ["Назва організації"] },
    {
      path: "/profil",
      auth: true,
      // An operator has no organization, so it must be sent to the registry —
      // never back to the login form, which is where this used to loop.
      redirectsTo: orgName ? undefined : "/dzherela",
      // Redirects for an account with no organization; renders the org's own
      // name for one that has it. The two state labels are checked because the
      // page rendering at all is a weaker claim than the page rendering the
      // distinction the product is built on.
      expect: orgName ? [orgName, "Підтверджено", "Зі слів організації"] : undefined,
    },
    {
      path: "/mozhlyvosti",
      auth: true,
      // Renders whether or not a feed has been built — the empty state is a
      // screen, not an absence, and it is the one most organizations see first.
      expect: orgName ? ["Гранти для вашої організації"] : undefined,
      redirectsTo: orgName ? undefined : "/dzherela",
    },
    {
      path: "/zayavky",
      auth: true,
      expect: orgName ? ["Над чим ви працюєте"] : undefined,
      redirectsTo: orgName ? undefined : "/dzherela",
    },
    {
      path: "/dzherela",
      auth: true,
      expect: isAdmin ? ["Ресурсний центр ГУРТ", "Громадський Простір"] : undefined,
      redirectsTo: isAdmin ? undefined : "/profil",
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
    const redirected = res.status === 307 || res.status === 302 || res.status === 303;
    const target = redirected ? (res.headers.get("location") ?? "") : null;
    const wrongTarget =
      route.redirectsTo !== undefined && (!redirected || !target?.endsWith(route.redirectsTo));

    const ok =
      ((res.status === 200 && !brokeInPlace) || redirected) &&
      missing.length === 0 &&
      !wrongTarget;

    if (!ok) failures += 1;
    const label = brokeInPlace
      ? `${res.status} (error boundary)`
      : wrongTarget
        ? `${res.status} → ${target ?? "no redirect"}, expected ${route.redirectsTo}`
        : missing.length > 0
          ? `${res.status} — missing: ${missing.join(", ")}`
          : redirected
            ? `${res.status} → ${target}`
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
