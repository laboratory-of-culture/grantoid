/**
 * Registration and sign-in.
 *
 * Registration creates the account, the organization and the membership in one
 * transaction, and seeds an UNKNOWN row for every key in the fact registry —
 * that seeding is not optional bookkeeping. `docs/DECISIONS.md` D4 says absence
 * is a stored state, and an organization whose facts simply do not exist yet
 * would make the eligibility agent infer silence from a missing row.
 */

import { FACT_KEYS } from "../schemas/fact-registry";
import { prisma } from "../db/tenancy";
import { hashPassword, verifyPassword, WeakPassword } from "./password";

export class RegistrationFailed extends Error {}
export class SignInFailed extends Error {}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isPlausibleEmail(email: string): boolean {
  // Deliberately loose. Address syntax is far stranger than any regex people
  // write for it, and the only real check is sending mail to it.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export type RegisterInput = {
  email: string;
  password: string;
  organizationName: string;
  displayName?: string;
};

export async function register(input: RegisterInput): Promise<{ userId: string; organizationId: string }> {
  const email = normalizeEmail(input.email);
  const organizationName = input.organizationName.trim();

  if (!isPlausibleEmail(email)) {
    throw new RegistrationFailed("Перевірте адресу електронної пошти.");
  }
  if (organizationName.length < 2) {
    throw new RegistrationFailed("Вкажіть назву організації.");
  }

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(input.password);
  } catch (err) {
    if (err instanceof WeakPassword) throw new RegistrationFailed(err.message);
    throw err;
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    throw new RegistrationFailed(
      "Обліковий запис із такою адресою вже існує. Увійдіть або відновіть пароль.",
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, displayName: input.displayName?.trim() || null },
      });

      const organization = await tx.organization.create({
        data: { name: organizationName, profileCompleteness: 0 },
      });

      await tx.membership.create({
        data: { userId: user.id, organizationId: organization.id, role: "OWNER" },
      });

      // Every registry key gets a row, defaulting to UNKNOWN. See D4.
      await tx.organizationFact.createMany({
        data: FACT_KEYS.map((key) => ({
          organizationId: organization.id,
          key,
          state: "UNKNOWN" as const,
        })),
      });

      await tx.auditEntry.create({
        data: {
          organizationId: organization.id,
          actorType: "USER",
          actorId: user.id,
          action: "organization.created",
          subjectType: "Organization",
          subjectId: organization.id,
          toState: "ACTIVE",
        },
      });

      return { userId: user.id, organizationId: organization.id };
    });
  } catch (err) {
    // The unique index is the real guard against two simultaneous signups with
    // the same address; the check above only makes the common case a nice
    // message rather than a crash.
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      throw new RegistrationFailed(
        "Обліковий запис із такою адресою вже існує. Увійдіть або відновіть пароль.",
      );
    }
    throw err;
  }
}

/**
 * Verify credentials.
 *
 * The same message for an unknown address and a wrong password, on purpose:
 * distinguishing them turns the sign-in form into a way to enumerate which
 * NGOs use the product.
 */
export async function signIn(emailRaw: string, password: string): Promise<string> {
  const email = normalizeEmail(emailRaw);
  const user = await prisma.user.findUnique({ where: { email } });

  const wrong = "Неправильна адреса або пароль.";

  if (!user) {
    // Hash anyway, so a missing account does not answer measurably faster than
    // a wrong password.
    await verifyPassword(password, "scrypt$131072$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
    throw new SignInFailed(wrong);
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new SignInFailed(wrong);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
  return user.id;
}
