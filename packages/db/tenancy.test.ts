/**
 * Isolation tests.
 *
 * These run against the live dev database and create two organizations, because
 * a tenancy test with one tenant proves nothing — the failure mode is that
 * organization A can see organization B, and you need a B to find out.
 *
 * Skipped automatically when no database is reachable, so CI without a Postgres
 * service does not go red on an absent dependency. `npm run db:up` first.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createFact, updateFact } from "./repositories";
import { forOrganization, prisma } from "./tenancy";

const A = "test-org-a";
const B = "test-org-b";

/**
 * Probed at module scope, not in `beforeAll`.
 *
 * `runIf` is evaluated when the suite is collected, which happens before any
 * hook runs — and it takes a boolean, not a predicate. Passing a function makes
 * every condition truthy, so the first version of this guard never skipped
 * anything and the suite simply failed when Postgres was down.
 */
const reachable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false);

beforeAll(async () => {
  if (!reachable) return;
  await cleanup();
  await prisma.organization.createMany({
    data: [
      { id: A, name: "Організація А" },
      { id: B, name: "Організація Б" },
    ],
  });
  await prisma.organizationFact.createMany({
    data: [
      { organizationId: A, key: "team_size", state: "SELF_REPORTED", valueText: "6" },
      { organizationId: B, key: "team_size", state: "SELF_REPORTED", valueText: "12" },
      { organizationId: B, key: "is_publisher", state: "EXPLICIT_NEGATIVE", valueText: "ні" },
    ],
  });
});

afterAll(async () => {
  if (reachable) await cleanup();
  await prisma.$disconnect();
});

async function cleanup() {
  await prisma.organizationFact.deleteMany({ where: { organizationId: { in: [A, B] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [A, B] } } });
}

describe("forOrganization", () => {
  it.runIf(reachable)("returns only the caller's rows", async () => {
    const db = forOrganization(A);
    const facts = await db.organizationFact.findMany();
    expect(facts).toHaveLength(1);
    expect(facts[0]?.valueText).toBe("6");
  });

  it.runIf(reachable)("throws rather than silently rescoping a cross-tenant query", async () => {
    // The first version of this silently rewrote the caller's organizationId to
    // the scoped one, so asking for tenant B returned tenant A's rows and looked
    // like it had worked. Failing loudly is the whole point.
    const db = forOrganization(A);
    await expect(
      db.organizationFact.findMany({ where: { organizationId: B } }),
    ).rejects.toThrow(/scoped to test-org-a/);
  });

  it.runIf(reachable)("allows a redundant filter naming its own tenant", async () => {
    const db = forOrganization(A);
    const facts = await db.organizationFact.findMany({
      where: { organizationId: A },
    });
    expect(facts).toHaveLength(1);
  });

  it.runIf(reachable)("stamps the organization on create", async () => {
    const db = forOrganization(A);
    const created = await createFact(db, {
      key: "edrpou",
      state: "SELF_REPORTED",
      valueText: "12345678",
    });
    expect(created.organizationId).toBe(A);
    await prisma.organizationFact.delete({ where: { id: created.id } });
  });

  it.runIf(reachable)("refuses to update a row belonging to another tenant", async () => {
    const bFact = await prisma.organizationFact.findFirstOrThrow({
      where: { organizationId: B },
    });
    // A leaked or guessed primary key carries no tenant, so the helper checks
    // ownership with a scoped read before it writes.
    await expect(
      updateFact(forOrganization(A), bFact.id, { valueText: "tampered" }),
    ).rejects.toThrow(/does not belong to this organization/);

    const after = await prisma.organizationFact.findUniqueOrThrow({ where: { id: bFact.id } });
    expect(after.valueText).toBe(bFact.valueText);
  });

  it.runIf(reachable)("scopes deleteMany, so one tenant cannot clear another", async () => {
    const db = forOrganization(A);
    await db.organizationFact.deleteMany({ where: {} });
    const survivors = await prisma.organizationFact.findMany({
      where: { organizationId: B },
    });
    expect(survivors.length).toBeGreaterThan(0);
  });

  it.runIf(reachable)("leaves public grant data unfiltered", async () => {
    const db = forOrganization(A);
    await expect(db.grant.count()).resolves.toBeTypeOf("number");
  });

  it("refuses an empty organization id rather than querying everything", () => {
    expect(() => forOrganization("")).toThrow(/requires an organization id/);
  });

  it.runIf(reachable)("refuses a model it cannot scope", async () => {
    const db = forOrganization(A);
    await expect(db.criterionAssessment.findMany()).rejects.toThrow(
      /cannot be queried directly/,
    );
  });

  it.runIf(reachable)("refuses a unique-key write it cannot filter", async () => {
    const db = forOrganization(A);
    await expect(
      db.organizationFact.update({ where: { id: "whatever" }, data: {} }),
    ).rejects.toThrow(/must go through the scoped helpers/);
  });
});
