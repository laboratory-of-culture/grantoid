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
 * Require a platform operator.
 *
 * Sends a signed-in non-admin to their own profile rather than to sign-in: they
 * are authenticated, just not an operator, and a login form would be a
 * confusing answer to "you may not see this".
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/vhid");
  if (!user.isAdmin) redirect("/profil");
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
  if (!ctx) redirect("/vhid");
  return ctx;
}
