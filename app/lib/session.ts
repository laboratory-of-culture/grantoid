/**
 * Current organization context.
 *
 * STUB. Authentication is not built yet, so this resolves the single seeded
 * organization. It exists as a function rather than a constant so that adding
 * auth is a change in one place — every caller already asks "who is this?"
 * instead of assuming.
 *
 * The tenancy layer (`packages/db/tenancy.ts`) is real and enforced regardless;
 * this only decides *which* organization the scoped client is bound to. That
 * ordering is deliberate — retrofitting isolation after documents exist is the
 * case where one forgotten filter goes unnoticed.
 */

import { forOrganization, prisma, type ScopedClient } from "../../packages/db/tenancy";

export async function currentOrganizationId(): Promise<string | null> {
  const fromEnv = process.env.GRANT_AI_ORG_ID;
  if (fromEnv) return fromEnv;

  const first = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return first?.id ?? null;
}

/** The scoped client for the current organization, or null if none is seeded. */
export async function currentDb(): Promise<{ db: ScopedClient; organizationId: string } | null> {
  const organizationId = await currentOrganizationId();
  if (!organizationId) return null;
  return { db: forOrganization(organizationId), organizationId };
}
