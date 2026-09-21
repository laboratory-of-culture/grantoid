/**
 * closeExpiredGrants against a real database. DB-gated, like the other data
 * tests: it runs where Postgres is reachable and skips where it is not.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closeExpiredGrants } from "./expiry";
import { prisma } from "../db/tenancy";

const reachable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false);

const PREFIX = "test-expiry-";
const now = new Date("2026-09-21T12:00:00Z");
const past = new Date("2026-09-01T00:00:00Z");
const future = new Date("2026-12-01T00:00:00Z");

async function cleanup() {
  await prisma.grant.deleteMany({ where: { id: { startsWith: PREFIX } } });
}

async function grant(id: string, data: Record<string, unknown>) {
  await prisma.grant.create({
    data: {
      id: PREFIX + id,
      title: id,
      titleUk: id,
      donorName: "Тест",
      sourceUrl: `https://example.org/${id}`,
      sourceId: null,
      retrievedAt: now,
      lastCheckedAt: now,
      ...data,
    } as never,
  });
}

beforeEach(async () => {
  if (reachable) await cleanup();
});
afterAll(async () => {
  if (reachable) await cleanup();
  await prisma.$disconnect();
});

describe.runIf(reachable)("closeExpiredGrants", () => {
  it("closes only known-past-deadline calls that are not already closed", async () => {
    await grant("expired-open", { status: "OPEN", deadlineIsKnown: true, deadline: past });
    await grant("expired-unknown-status", { status: "UNKNOWN", deadlineIsKnown: true, deadline: past });
    await grant("future-open", { status: "OPEN", deadlineIsKnown: true, deadline: future });
    await grant("no-deadline", { status: "OPEN", deadlineIsKnown: false, deadline: null });
    await grant("already-closed", { status: "CLOSED", deadlineIsKnown: true, deadline: past, closedSeenAt: past });

    const count = await closeExpiredGrants(now);
    expect(count).toBe(2); // the two past-deadline, not-yet-closed ones

    const status = async (id: string) =>
      (await prisma.grant.findUnique({ where: { id: PREFIX + id }, select: { status: true } }))?.status;
    expect(await status("expired-open")).toBe("CLOSED");
    expect(await status("expired-unknown-status")).toBe("CLOSED");
    expect(await status("future-open")).toBe("OPEN");
    expect(await status("no-deadline")).toBe("OPEN");
  });

  it("leaves the original closedSeenAt on an already-closed call untouched", async () => {
    await grant("already-closed", { status: "CLOSED", deadlineIsKnown: true, deadline: past, closedSeenAt: past });
    await closeExpiredGrants(now);
    const row = await prisma.grant.findUnique({ where: { id: PREFIX + "already-closed" }, select: { closedSeenAt: true } });
    expect(row?.closedSeenAt?.toISOString()).toBe(past.toISOString());
  });
});
