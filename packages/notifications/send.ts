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
import { renderDigestHtml } from "./html";
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

/**
 * The origin every link in the message is built from.
 *
 * A localhost default is right for the file transport and catastrophic for a
 * real one: an operator who configures SMTP without knowing this variable exists
 * mails NGOs a digest whose every link — the unsubscribe link included — points
 * at their own machine. Unsubscribing then cannot work at all, which is the
 * precise outcome that gets a sender reported as spam. So a real transport has
 * to be told, and refusing is the only failure mode that stays visible.
 */
export function baseUrl(transportName: string): string {
  const configured = process.env.APP_BASE_URL;
  if (configured) return configured;

  if (transportName !== "file") {
    throw new Error(
      "APP_BASE_URL is required when mail actually leaves: every link in the " +
        "digest, including the unsubscribe link, is built from it.",
    );
  }
  return "http://localhost:3000";
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

/**
 * Is this token one we issued? A read, and nothing else.
 *
 * Lets the page say «посилання не спрацювало» before offering a button that
 * would fail — a person who truncated the link while copying learns it
 * immediately rather than after an action that appears broken.
 *
 * Safe as a GET precisely because it writes nothing: the reason the unsubscribe
 * itself is a POST is that mail scanners fetch every URL in a message, and a
 * lookup they perform costs nobody anything.
 */
export async function unsubscribeTokenExists(token: string): Promise<boolean> {
  if (token.trim().length === 0) return false;
  const user = await prisma.user.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true },
  });
  return user !== null;
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
  // Resolved once, before anything is sent. Inside the loop a missing
  // APP_BASE_URL would be caught per user and reported as a per-mailbox
  // failure — a configuration error wearing the costume of a delivery problem.
  const origin = baseUrl(transport.name);
  const due = new Date(now.getTime() - DIGEST_INTERVAL_DAYS * 86_400_000);

  const users = await prisma.user.findMany({
    where: {
      digestOptIn: true,
      // Someone with no organization has no feed to write about. Excluded here
      // rather than skipped in the loop so `considered` is a number an operator
      // can reconcile against sent + skipped + failed.
      memberships: { some: {} },
      ...(opts.force ? {} : { OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: due } }] }),
    },
    // Same ordering as `resolveSession`, and for the same reason: without it
    // the "first" membership is whatever Postgres returns, so someone in two
    // NGOs could be mailed about one organization while the app signs them into
    // the other.
    include: {
      memberships: {
        orderBy: { createdAt: "asc" },
        take: 1,
        include: { organization: true },
      },
    },
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
        origin,
        token,
        now,
      );

      await transport.send({
        to: user.email,
        subject: digest.subject,
        text: digest.text,
        html: renderDigestHtml(digest, membership.organization.name),
        unsubscribeUrl: digest.unsubscribeUrl,
      });

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
