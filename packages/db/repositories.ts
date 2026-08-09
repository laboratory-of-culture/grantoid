/**
 * Typed helpers over the scoped client.
 *
 * Two jobs, both of which exist because Prisma's generated types cannot see the
 * runtime extension in `tenancy.ts`:
 *
 *   Creates take an input *without* `organizationId` — the scoped client
 *   supplies it. The one cast that reconciles that is here, in a file whose
 *   whole purpose is the reconciliation, rather than scattered at call sites
 *   where the next reader would have to work out whether it was safe.
 *
 *   Unique-key writes (update, delete) cannot carry a tenant filter, so the
 *   scoped client refuses them outright. These helpers check ownership with a
 *   scoped read first, then perform the write.
 */

import type { Prisma } from "@prisma/client";

import { prisma, type ScopedClient } from "./tenancy";

type FactCreate = Omit<Prisma.OrganizationFactUncheckedCreateInput, "organizationId">;
type FactUpdate = Omit<Prisma.OrganizationFactUncheckedUpdateInput, "organizationId">;

export async function createFact(db: ScopedClient, data: FactCreate) {
  // The scoped client injects organizationId; the generated type cannot know
  // that, so this is where the two are reconciled.
  return db.organizationFact.create({
    data: data as Prisma.OrganizationFactUncheckedCreateInput,
  });
}

/**
 * Update a fact after confirming the caller owns it.
 *
 * The scoped read is not a formality: `update` addresses a row by primary key,
 * and a primary key carries no tenant. Without this check, a guessed or leaked
 * id would write across the boundary.
 */
export async function updateFact(db: ScopedClient, id: string, data: FactUpdate) {
  const owned = await db.organizationFact.findFirst({ where: { id }, select: { id: true } });
  if (!owned) {
    throw new Error(`fact ${id} does not belong to this organization`);
  }
  return prisma.organizationFact.update({
    where: { id },
    data: data as Prisma.OrganizationFactUncheckedUpdateInput,
  });
}

export async function deleteFact(db: ScopedClient, id: string) {
  const owned = await db.organizationFact.findFirst({ where: { id }, select: { id: true } });
  if (!owned) {
    throw new Error(`fact ${id} does not belong to this organization`);
  }
  return prisma.organizationFact.delete({ where: { id } });
}
