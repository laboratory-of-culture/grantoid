/**
 * Password and session tests.
 *
 * The password ones need no database. The session and registration ones do, and
 * skip themselves when Postgres is not reachable — same guard as the isolation
 * tests, evaluated at module scope because `runIf` takes a boolean.
 */

import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "../db/tenancy";
import { normalizeEmail, isPlausibleEmail, register, signIn } from "./accounts";
import { MIN_PASSWORD_LENGTH, hashPassword, needsRehash, verifyPassword } from "./password";
import { createSession, destroySession, hashToken, resolveSession } from "./session";

const reachable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false);

const created: string[] = [];

afterAll(async () => {
  if (reachable && created.length > 0) {
    await prisma.user.deleteMany({ where: { email: { in: created } } });
    await prisma.organization.deleteMany({ where: { name: { startsWith: "ТЕСТ " } } });
  }
  await prisma.$disconnect();
});

describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("довга парольна фраза");
    await expect(verifyPassword("довга парольна фраза", hash)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("довга парольна фраза");
    await expect(verifyPassword("довга парольна фразb", hash)).resolves.toBe(false);
  });

  it("produces a different hash each time", async () => {
    const a = await hashPassword("довга парольна фраза");
    const b = await hashPassword("довга парольна фраза");
    expect(a).not.toBe(b); // random salt
  });

  it("refuses a short password", async () => {
    await expect(hashPassword("короткий")).rejects.toThrow(
      new RegExp(String(MIN_PASSWORD_LENGTH)),
    );
  });

  it("handles Cyrillic and emoji without mangling them", async () => {
    const pw = "Пароль із ромашкою 🌼 і пробілами";
    const hash = await hashPassword(pw);
    await expect(verifyPassword(pw, hash)).resolves.toBe(true);
  });

  it("returns false rather than throwing on a corrupted hash", async () => {
    await expect(verifyPassword("whatever", "not-a-hash")).resolves.toBe(false);
    await expect(verifyPassword("whatever", "scrypt$x$y$z$aa$bb")).resolves.toBe(false);
    await expect(verifyPassword("whatever", "")).resolves.toBe(false);
  });

  it("flags a hash made with weaker parameters", () => {
    expect(needsRehash("scrypt$16384$8$1$c2FsdA==$aGFzaA==")).toBe(true);
    expect(needsRehash("bcrypt$whatever")).toBe(true);
  });
});

describe("email handling", () => {
  it("lowercases and trims, so case cannot create a second account", () => {
    expect(normalizeEmail("  Test@Example.COM ")).toBe("test@example.com");
  });

  it("accepts ordinary addresses and rejects obvious nonsense", () => {
    expect(isPlausibleEmail("ngo@example.org")).toBe(true);
    expect(isPlausibleEmail("не пошта")).toBe(false);
    expect(isPlausibleEmail("a@b")).toBe(false);
  });
});

describe.runIf(reachable)("registration", () => {
  it("creates the account, the organization and a full set of UNKNOWN facts", async () => {
    const email = `smoke-${Date.now()}@example.org`;
    created.push(email);

    const { organizationId } = await register({
      email,
      password: "довга парольна фраза",
      organizationName: "ТЕСТ Організація",
    });

    const facts = await prisma.organizationFact.findMany({ where: { organizationId } });
    expect(facts.length).toBeGreaterThan(0);
    // D4: absence is a stored state. An organization whose facts do not exist
    // would let the eligibility agent infer silence from a missing row.
    expect(facts.every((f) => f.state === "UNKNOWN")).toBe(true);
  });

  it("refuses a second account on the same address, whatever the case", async () => {
    const email = `dup-${Date.now()}@example.org`;
    created.push(email);
    await register({
      email,
      password: "довга парольна фраза",
      organizationName: "ТЕСТ Дубль",
    });

    await expect(
      register({
        email: email.toUpperCase(),
        password: "інша довга фраза",
        organizationName: "ТЕСТ Дубль два",
      }),
    ).rejects.toThrow(/вже існує/);
  });
});

describe.runIf(reachable)("sign in", () => {
  it("accepts the right password and rejects the wrong one with the same message", async () => {
    const email = `signin-${Date.now()}@example.org`;
    created.push(email);
    await register({
      email,
      password: "довга парольна фраза",
      organizationName: "ТЕСТ Вхід",
    });

    await expect(signIn(email, "довга парольна фраза")).resolves.toBeTypeOf("string");

    // Identical message for both, so the form cannot be used to find out which
    // NGOs have accounts.
    //
    // Awaited together rather than in sequence: starting both promises and then
    // awaiting them one after another leaves the second rejecting with no
    // handler attached while the first spends ~800ms in scrypt, which Node
    // reports as an unhandled rejection and Vitest warns can mask real failures.
    await Promise.all([
      expect(signIn(email, "не той пароль")).rejects.toThrow(
        /Неправильна адреса або пароль/,
      ),
      expect(signIn(`absent-${Date.now()}@example.org`, "будь-що")).rejects.toThrow(
        /Неправильна адреса або пароль/,
      ),
    ]);
  });
});

describe.runIf(reachable)("sessions", () => {
  it("round-trips a token and resolves the organization", async () => {
    const email = `sess-${Date.now()}@example.org`;
    created.push(email);
    const { userId, organizationId } = await register({
      email,
      password: "довга парольна фраза",
      organizationName: "ТЕСТ Сесія",
    });

    const { token } = await createSession(userId);
    const resolved = await resolveSession(token);

    expect(resolved?.userId).toBe(userId);
    expect(resolved?.organizationId).toBe(organizationId);
  });

  it("stores only the hash, never the token", async () => {
    const email = `hash-${Date.now()}@example.org`;
    created.push(email);
    const { userId } = await register({
      email,
      password: "довга парольна фраза",
      organizationName: "ТЕСТ Хеш",
    });

    const { token } = await createSession(userId);
    const rows = await prisma.session.findMany({ where: { userId } });
    expect(rows[0]?.tokenHash).toBe(hashToken(token));
    expect(rows[0]?.tokenHash).not.toBe(token);
  });

  it("returns null for absent, unknown and destroyed tokens alike", async () => {
    const email = `null-${Date.now()}@example.org`;
    created.push(email);
    const { userId } = await register({
      email,
      password: "довга парольна фраза",
      organizationName: "ТЕСТ Нуль",
    });
    const { token } = await createSession(userId);

    await expect(resolveSession(undefined)).resolves.toBeNull();
    await expect(resolveSession("made-up-token")).resolves.toBeNull();

    await destroySession(token);
    await expect(resolveSession(token)).resolves.toBeNull();
  });

  it("refuses an expired session and cleans it up", async () => {
    const email = `exp-${Date.now()}@example.org`;
    created.push(email);
    const { userId } = await register({
      email,
      password: "довга парольна фраза",
      organizationName: "ТЕСТ Прострочена",
    });

    const { token } = await createSession(userId);
    await prisma.session.updateMany({
      where: { tokenHash: hashToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(resolveSession(token)).resolves.toBeNull();
    const left = await prisma.session.findMany({ where: { tokenHash: hashToken(token) } });
    expect(left).toHaveLength(0);
  });
});
