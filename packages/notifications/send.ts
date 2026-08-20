/**
 * Sending the weekly digest.
 *
 * Opt-in only, and the opt-in is per person rather than per organization: two
 * people in the same NGO can want different things from their inbox, and
 * subscribing a colleague is not a decision anyone gets to make for them.
 */

import { randomBytes } from "node:crypto";

import { loadFeed } from "../matching/feed";
import { prisma } from "../db/tenancy";
import { buildDigest, selectForDigest } from "./digest";
import { mailTransport, type MailTransport } from "./mail";

export const DIGEST_INTERVAL_DAYS = 7;

export type DigestOutcome = {
  considered: number;
  sent: number;
  /** Subscribed, but had nothing new worth an email. */
  skippedEmpty: number;
  failed: number;
  transport: string;
  errors: { email: string; error: string }[];
};

export function baseUrl(): string {
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}

/**
 * A person's unsubscribe token, minted on first need.
 *
 * Not generated at registration: most accounts never subscribe, and a token
 * that exists for everyone is a credential lying around for no reason.
 */
export async function ensureUnsubscribeToken(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { unsubscribeToken: true },
  });
  if (user.unsubscribeToken) return user.unsubscribeToken;

  const token = randomBytes(24).toString("base64url");
  await prisma.user.update({ where: { id: userId }, data: { unsubscribeToken: token } });
  return token;
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  if (token.trim().length === 0) return false;
  const user = await prisma.user.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true },
  });
  if (!user) return false;

  await prisma.user.update({
    where: { id: user.id },
    // The token survives: a second click on the same link must say "you are
    // unsubscribed" rather than "this link is invalid", which reads like the
    // unsubscribe failed and sends people to the spam button.
    data: { digestOptIn: false },
  });
  return true;
}

export async function sendDueDigests(
  opts: { now?: Date; transport?: MailTransport; force?: boolean } = {},
): Promise<DigestOutcome> {
  const now = opts.now ?? new Date();
  const transport = opts.transport ?? mailTransport();
  const due = new Date(now.getTime() - DIGEST_INTERVAL_DAYS * 86_400_000);

  const users = await prisma.user.findMany({
    where: {
      digestOptIn: true,
      ...(opts.force ? {} : { OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: due } }] }),
    },
    include: { memberships: { include: { organization: true } } },
  });

  const outcome: DigestOutcome = {
    considered: users.length,
    sent: 0,
    skippedEmpty: 0,
    failed: 0,
    transport: transport.name,
    errors: [],
  };

  for (const user of users) {
    const membership = user.memberships[0];
    if (!membership) continue;

    try {
      const feed = await loadFeed(membership.organizationId, { recommendedOnly: true });
      const picked = selectForDigest(feed.entries, user.lastDigestAt, now);

      // Nothing new is not a reason to write. A weekly "нічого не знайшлося"
      // trains people to stop opening the ones that do carry something.
      if (picked.length === 0) {
        outcome.skippedEmpty += 1;
        continue;
      }

      const token = await ensureUnsubscribeToken(user.id);
      const digest = buildDigest(
        membership.organization.name,
        picked,
        baseUrl(),
        token,
      );

      await transport.send({ to: user.email, subject: digest.subject, text: digest.text });

      await prisma.user.update({ where: { id: user.id }, data: { lastDigestAt: now } });
      outcome.sent += 1;
    } catch (err) {
      // One bad mailbox must not stop the rest, and `lastDigestAt` stays put so
      // the next run retries rather than skipping a week.
      outcome.failed += 1;
      outcome.errors.push({ email: user.email, error: String(err) });
    }
  }

  return outcome;
}
