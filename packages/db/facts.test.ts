/**
 * Answering profile questions by hand.
 *
 * The case worth the most here is `EXPLICIT_NEGATIVE`. It is the only state that
 * lets the eligibility engine reject an organization (D4), so if a person cannot
 * produce it, every requirement the organization genuinely fails stays
 * permanently uncertain and the feed fills with grants it cannot win.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { citedPage } from "./extraction";

import { answerFact, clearFact, AnswerRejected } from "./facts";
import { forOrganization, prisma } from "./tenancy";

const ORG = "test-org-facts";

const reachable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false);

const db = forOrganization(ORG);

beforeEach(async () => {
  if (!reachable) return;
  await cleanup();
  await prisma.organization.create({ data: { id: ORG, name: "ТЕСТ Факти" } });
});

afterAll(async () => {
  if (reachable) await cleanup();
  await prisma.$disconnect();
});

async function cleanup() {
  await prisma.auditEntry.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationFact.deleteMany({ where: { organizationId: ORG } });
  await prisma.organization.deleteMany({ where: { id: ORG } });
}

async function factFor(key: string) {
  return prisma.organizationFact.findFirst({ where: { organizationId: ORG, key } });
}

describe.runIf(reachable)("answerFact", () => {
  it("records a typed answer as SELF_REPORTED, never CONFIRMED", async () => {
    await answerFact(db, ORG, { key: "team_size", value: "6" }, "u1");
    const fact = await factFor("team_size");
    // Typing a value is not the same as a human checking it against a document.
    expect(fact?.state).toBe("SELF_REPORTED");
    expect(fact?.confirmedAt).toBeNull();
    expect(fact?.valueText).toBe("6");
  });

  it("records «we have none» as EXPLICIT_NEGATIVE", async () => {
    await answerFact(db, ORG, { key: "international_partners", negative: true }, "u1");
    const fact = await factFor("international_partners");
    expect(fact?.state).toBe("EXPLICIT_NEGATIVE");
    expect(fact?.valueText).toBe("немає");
  });

  it("stores a boolean no as a confirmed negative, not the text «ні»", async () => {
    await answerFact(db, ORG, { key: "is_publisher", negative: true }, "u1");
    const fact = await factFor("is_publisher");
    expect(fact?.state).toBe("EXPLICIT_NEGATIVE");
    expect(fact?.valueText).toBe("ні");
  });

  it("accepts a number written the way Ukrainians write it", async () => {
    await answerFact(db, ORG, { key: "annual_budget_uah", value: "12 500,50" }, "u1");
    expect((await factFor("annual_budget_uah"))?.valueText).toBe("12500.5");
  });

  it("splits a list on newlines and keeps the items", async () => {
    await answerFact(
      db,
      ORG,
      { key: "activity_areas", value: "молодіжна робота\n\nосвіта\n" },
      "u1",
    );
    const fact = await factFor("activity_areas");
    expect(fact?.valueText).toBe("молодіжна робота; освіта");
    expect(fact?.valueJson).toEqual(["молодіжна робота", "освіта"]);
  });

  it("rejects a value that is not of the field's kind", async () => {
    await expect(
      answerFact(db, ORG, { key: "team_size", value: "шість" }, "u1"),
    ).rejects.toThrow(AnswerRejected);
    await expect(
      answerFact(db, ORG, { key: "registration_date", value: "торік" }, "u1"),
    ).rejects.toThrow(AnswerRejected);
  });

  it("refuses a key that is not in the registry", async () => {
    await expect(
      answerFact(db, ORG, { key: "favourite_colour", value: "синій" }, "u1"),
    ).rejects.toThrow(/не існує в реєстрі/);
  });

  it("drops citations when a confirmed value is typed over", async () => {
    await answerFact(db, ORG, { key: "team_size", value: "6" }, "u1");
    const fact = await factFor("team_size");
    await prisma.organizationFact.update({
      where: { id: fact!.id },
      data: { state: "CONFIRMED", confirmedAt: new Date() },
    });
    await prisma.citation.create({
      data: {
        quote: "У штаті шість осіб.",
        retrievedAt: new Date(),
        organizationFactId: fact!.id,
      },
    });

    await answerFact(db, ORG, { key: "team_size", value: "12" }, "u1");

    // A document's sentence must not stay attached to a number typed over it.
    const citations = await prisma.citation.findMany({
      where: { organizationFactId: fact!.id },
    });
    expect(citations).toHaveLength(0);
    const after = await factFor("team_size");
    expect(after?.state).toBe("SELF_REPORTED");
    expect(after?.confirmedAt).toBeNull();
  });

  it("updates profile completeness", async () => {
    await answerFact(db, ORG, { key: "team_size", value: "6" }, "u1");
    const org = await prisma.organization.findUnique({ where: { id: ORG } });
    expect(org?.profileCompleteness).toBeGreaterThan(0);
  });

  it("writes an audit entry with the state transition", async () => {
    await answerFact(db, ORG, { key: "team_size", value: "6" }, "u1");
    const entries = await prisma.auditEntry.findMany({ where: { organizationId: ORG } });
    expect(entries[0]?.action).toBe("fact.answered");
    expect(entries[0]?.fromState).toBe("UNKNOWN");
    expect(entries[0]?.toState).toBe("SELF_REPORTED");
  });
});

describe.runIf(reachable)("clearFact", () => {
  it("returns a field to UNKNOWN without deleting the row", async () => {
    await answerFact(db, ORG, { key: "team_size", value: "6" }, "u1");
    await clearFact(db, ORG, "team_size", "u1");

    const fact = await factFor("team_size");
    // The row stays: an absent row and a stored UNKNOWN are different things,
    // and only one of them is representable to the eligibility agent (D4).
    expect(fact).not.toBeNull();
    expect(fact?.state).toBe("UNKNOWN");
    expect(fact?.valueText).toBeNull();
  });

  it("also withdraws an explicit negative", async () => {
    await answerFact(db, ORG, { key: "is_publisher", negative: true }, "u1");
    await clearFact(db, ORG, "is_publisher", "u1");
    expect((await factFor("is_publisher"))?.state).toBe("UNKNOWN");
  });
});

describe("citedPage", () => {
  it("drops a page the document does not have", () => {
    // Real: a two-page annual report came back with three facts cited to page 4.
    expect(citedPage(4, 2)).toBeNull();
  });

  it("keeps a page within the document", () => {
    expect(citedPage(2, 2)).toBe(2);
    expect(citedPage(1, 33)).toBe(1);
  });

  it("drops nonsense and keeps absence", () => {
    expect(citedPage(0, 5)).toBeNull();
    expect(citedPage(-1, 5)).toBeNull();
    expect(citedPage(null, 5)).toBeNull();
  });

  it("keeps the page when the document's length is unknown", () => {
    // A .txt has no pages to count. The model's number is the only thing there
    // is, and dropping it would lose a reference that may well be right.
    expect(citedPage(3, null)).toBe(3);
  });
});
