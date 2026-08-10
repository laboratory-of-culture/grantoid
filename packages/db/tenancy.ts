/**
 * Organization isolation, enforced once.
 *
 * The rule from the `pii-and-donor-data` skill is that a missing
 * `organizationId` filter is a data breach rather than a bug. A rule every route
 * has to remember is a rule that will be forgotten on a Friday, so it is
 * enforced here instead: `forOrganization()` returns a Prisma client that
 * injects the filter on every read and write of a tenant-scoped model, and
 * refuses to touch one at all if it cannot.
 *
 * Deliberately fails closed. A tenant-scoped model reached without an
 * organization context throws — it does not fall back to querying everything,
 * which is the shape this bug normally takes.
 */

import { PrismaClient } from "@prisma/client";

/**
 * Models carrying a direct `organizationId`. These are filtered automatically.
 */
const DIRECTLY_SCOPED = new Set([
  "OrganizationFact",
  "FactCandidate",
  "Document",
  "Match",
  "AuditEntry",
]);

/**
 * Models that belong to a tenant only through a parent. They cannot be filtered
 * by a column, so reaching them through the scoped client is an error — go via
 * the parent relation, where the filter does apply.
 */
const SCOPED_VIA_PARENT = new Set([
  "CriterionAssessment", // via Match
  "Citation", // via Document / OrganizationFact
]);

/** Models with no tenant dimension. Grant data is public — see the skill. */
const SHARED = new Set([
  "Source",
  "Grant",
  "GrantEligibilityRule",
  "GrantFact",
  "GrantSnapshot",
  "GrantChunk",
  "Organization",
]);

const READS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

const WRITES_MANY = new Set(["updateMany", "deleteMany"]);
const CREATES = new Set(["create", "createMany"]);

const base = new PrismaClient();

/** The unscoped client. Use only for shared data, migrations and seeds. */
export const prisma = base;

export type ScopedClient = ReturnType<typeof forOrganization>;

/**
 * A Prisma client bound to one organization.
 *
 * ```ts
 * const db = forOrganization(orgId);
 * await db.organizationFact.findMany();   // implicitly WHERE organizationId = orgId
 * await db.grant.findMany();              // untouched — grants are public
 * await db.criterionAssessment.findMany() // throws — reach it through match
 * ```
 */
export function forOrganization(organizationId: string) {
  if (!organizationId) {
    throw new Error("forOrganization requires an organization id");
  }

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (SHARED.has(model)) return query(args);

          if (SCOPED_VIA_PARENT.has(model)) {
            throw new Error(
              `${model} cannot be queried directly through a scoped client — it ` +
                `has no organizationId column. Reach it through its parent ` +
                `relation, where the tenant filter applies.`,
            );
          }

          if (!DIRECTLY_SCOPED.has(model)) {
            // A model nobody has classified. Failing closed here is what makes
            // adding a table to the schema surface this decision instead of
            // silently creating an unscoped surface.
            throw new Error(
              `${model} is not classified in packages/db/tenancy.ts. Add it to ` +
                `DIRECTLY_SCOPED, SCOPED_VIA_PARENT or SHARED before querying it.`,
            );
          }

          const a = (args ?? {}) as Record<string, unknown>;

          if (READS.has(operation) || WRITES_MANY.has(operation)) {
            const where = (a.where ?? {}) as Record<string, unknown>;

            // Spreading our filter last would silently rewrite a caller's
            // explicit organizationId to ours — so a query written for tenant B
            // would quietly return tenant A's rows and look like it worked.
            // A caller naming a different tenant is a bug, and a loud one.
            if (
              typeof where.organizationId === "string" &&
              where.organizationId !== organizationId
            ) {
              throw new Error(
                `query on ${model} names organizationId ${where.organizationId} ` +
                  `but this client is scoped to ${organizationId}. Cross-tenant ` +
                  `access is not possible here; drop the filter or use the ` +
                  `unscoped client deliberately.`,
              );
            }

            return query({ ...a, where: { ...where, organizationId } });
          }

          if (operation === "create") {
            return query({
              ...a,
              data: { ...(a.data as object | undefined), organizationId },
            });
          }

          if (operation === "createMany") {
            const data = a.data;
            const rows = Array.isArray(data) ? data : [data];
            return query({
              ...a,
              data: rows.map((row) => ({ ...(row as object), organizationId })),
            });
          }

          // update / delete / upsert address a single row by unique key. Prisma
          // does not accept a non-unique field in `where` there, so the filter
          // cannot be injected — the caller must have loaded the row through a
          // scoped read first, and we verify rather than trust.
          if (operation === "update" || operation === "delete" || operation === "upsert") {
            throw new Error(
              `${operation} on ${model} must go through the scoped helpers in ` +
                `packages/db/repositories — a unique-key write cannot carry a ` +
                `tenant filter, so ownership has to be checked before the write.`,
            );
          }

          return query(args);
        },
      },
    },
  });
}
