/**
 * Who is signed in, and which organization they are acting for.
 *
 * The tenancy layer (`packages/db/tenancy.ts`) enforces isolation regardless of
 * what this returns; this only decides *which* organization the scoped client is
 * bound to. That ordering was deliberate — isolation went in before any
 * organization data existed, so there was never a window where a forgotten
 * filter could go unnoticed.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { forOrganization, type ScopedClient } from "../../packages/db/tenancy";
import { SESSION_COOKIE, resolveSession, type SessionUser } from "../../packages/auth/session";

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return resolveSession(jar.get(SESSION_COOKIE)?.value);
}

export async function currentUserId(): Promise<string | null> {
  return (await currentUser())?.userId ?? null;
}

/** The scoped client for the signed-in organization, or null when signed out. */
export async function currentDb(): Promise<
  { db: ScopedClient; organizationId: string; user: SessionUser } | null
> {
  const user = await currentUser();
  // No organization means an operator account, which has no scoped client at
  // all — deliberately, so operator tooling cannot reach an NGO's documents.
  if (!user?.organizationId) return null;
  return {
    db: forOrganization(user.organizationId),
    organizationId: user.organizationId,
    user,
  };
}

/**
 * Where a signed-in person belongs.
 *
 * There is exactly one of these because the answer has to be the same in four
 * places — the root route, sign-in, registration, and the guard below — and when
 * it was not, the product looked broken in the most confusing possible way: the
 * operator account signed in successfully, was sent to /profil, which found no
 * organization and sent it back to the login form. From outside that is
 * indistinguishable from a wrong password, and it is the account with no
 * organization *by design* that hit it.
 */
export function landingFor(user: SessionUser): string {
  if (user.organizationId) return "/profil";
  if (user.isAdmin) return "/dzherela";
  // A member of nothing who is not an operator cannot be produced by
  // registration, which always creates an organization. If one exists, the data
  // is wrong, and failing loudly beats bouncing them between two screens.
  throw new Error(`user ${user.userId} has neither an organization nor operator rights`);
}

/**
 * Require a platform operator.
 *
 * Sends a signed-in non-admin to their own profile rather than to sign-in: they
 * are authenticated, just not an operator, and a login form would be a
 * confusing answer to "you may not see this".
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/vhid");
  if (!user.isAdmin) redirect(landingFor(user));
  return user;
}

/**
 * The same, but redirects instead of returning null.
 *
 * Used by the app layout so every page under it can assume a session rather
 * than each one remembering to check — a page that forgets is a page that
 * renders someone else's data or crashes, and neither is acceptable.
 */
export async function requireDb(): Promise<{
  db: ScopedClient;
  organizationId: string;
  user: SessionUser;
}> {
  const ctx = await currentDb();
  if (ctx) return ctx;

  // Signed out is the only case that belongs at the login form. Someone who is
  // signed in but has no organization is an operator who took a wrong turn, and
  // sending them to sign in again is the loop described above.
  const user = await currentUser();
  redirect(user ? landingFor(user) : "/vhid");
}
