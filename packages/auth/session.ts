/**
 * Sessions.
 *
 * The cookie carries a random 32-byte token; the database stores only its
 * SHA-256. A dump of the Session table therefore does not let anyone sign in as
 * anybody, which is the whole reason not to store the token itself.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { prisma } from "../db/tenancy";

export const SESSION_COOKIE = "ga_session";
const LIFETIME_DAYS = 30;
/** Sliding window: touch the expiry when a session is used within this margin. */
const REFRESH_AFTER_DAYS = 1;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * A signed-in person.
 *
 * The organization is optional because the platform operator has none: the
 * source registry belongs to nobody's NGO, and giving an operator account a
 * membership would put a real organization's documents one click away from it.
 * An earlier version required a membership here, which made the admin account
 * unable to sign in at all — the constraint and the decision contradicted each
 * other, and the decision is the one worth keeping.
 */
export type SessionUser = {
  userId: string;
  email: string;
  isAdmin: boolean;
  organizationId: string | null;
  organizationName: string | null;
};

export function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Lax rather than strict: strict drops the cookie on a link followed from an
    // email, which is exactly how a digest brings someone back to a grant.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LIFETIME_DAYS * 86_400_000);

  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });

  return { token, expiresAt };
}

/**
 * Resolve a cookie token to a user and their organization.
 *
 * Returns null for anything wrong — absent, unknown, expired — without
 * distinguishing, because the caller has nothing useful to do with the
 * difference and the distinction leaks whether a token ever existed.
 */
export async function resolveSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          memberships: {
            orderBy: { createdAt: "asc" },
            take: 1,
            include: { organization: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    // Clean up on the way past rather than waiting for a sweep.
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  const membership = session.user.memberships[0] ?? null;

  const stale = Date.now() - session.lastUsedAt.getTime() > REFRESH_AFTER_DAYS * 86_400_000;
  if (stale) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: {
          lastUsedAt: new Date(),
          expiresAt: new Date(Date.now() + LIFETIME_DAYS * 86_400_000),
        },
      })
      .catch(() => undefined);
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    isAdmin: session.user.isAdmin,
    organizationId: membership?.organization.id ?? null,
    organizationName: membership?.organization.name ?? null,
  };
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** Sign out everywhere. Used after a password change. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

/**
 * Constant-time string compare, for anywhere a token is compared outside the
 * database's own index lookup.
 */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
