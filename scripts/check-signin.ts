/**
 * Does the credential check pass, and does the resulting cookie open /profil?
 *
 *   npx tsx scripts/check-signin.ts [email] [password]
 *
 * Two questions, deliberately asked separately. A sign-in that fails at the
 * password and a sign-in that succeeds but lands nowhere look identical from the
 * form, and they have nothing in common as bugs.
 */

import { SignInFailed, signIn } from "../packages/auth/accounts";
import { SESSION_COOKIE, cookieOptions, createSession, resolveSession } from "../packages/auth/session";
import { prisma } from "../packages/db/tenancy";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

async function main(): Promise<void> {
  const email = process.argv[2] ?? "laboratoryofculture@gmail.com";
  const password = process.argv[3] ?? "laboratoriya-2026";

  console.log(`email     ${email}`);
  console.log(`password  ${"*".repeat(password.length)} (${password.length} chars)\n`);

  let userId: string;
  try {
    userId = await signIn(email, password);
    console.log(`1. credentials   ok — user ${userId}`);
  } catch (err) {
    if (err instanceof SignInFailed) {
      console.log(`1. credentials   REJECTED — ${err.message}`);
      const exists = await prisma.user.findUnique({ where: { email } });
      console.log(`   account ${exists ? "exists" : "does not exist"} for that address`);
      return;
    }
    throw err;
  }

  const { token, expiresAt } = await createSession(userId);
  console.log(`2. session       created, expires ${expiresAt.toISOString()}`);

  const resolved = await resolveSession(token);
  console.log(
    `3. resolves      ${resolved ? `ok — ${resolved.email}, org ${resolved.organizationName ?? "none"}` : "FAILED"}`,
  );

  const opts = cookieOptions(expiresAt);
  console.log(
    `4. cookie flags  httpOnly=${opts.httpOnly} sameSite=${opts.sameSite} secure=${opts.secure} path=${opts.path}`,
  );

  const res = await fetch(`${BASE}/profil`, {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
    redirect: "manual",
  });
  console.log(
    `5. GET /profil   ${res.status}${res.status !== 200 ? ` → ${res.headers.get("location")}` : ""}`,
  );

  const open = await prisma.session.count({ where: { userId } });
  console.log(`\nopen sessions for this user: ${open}`);
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
