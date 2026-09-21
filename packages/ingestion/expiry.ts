/**
 * Closing a call once its deadline is in the past.
 *
 * Change detection closes a call when a crawl finds it gone; this closes one the
 * calendar has closed, which a crawl never sees — a donor rarely edits a page to
 * say "this is over", the date simply passes. Without it a call sits `OPEN` with
 * a deadline weeks gone: the matcher already refuses to recommend it
 * (`deadlinePassed` in prefilter), so nobody is shown an expired opportunity,
 * but it stays a live-looking row that every match pass re-filters and that any
 * screen reading `status` would show as open.
 *
 * Only a *known* past deadline closes a call. An unknown deadline is not a
 * closed call — extraction routinely fails to find one, and treating "we could
 * not read a date" as "the date has passed" would retire calls that are still
 * open. `closedSeenAt` records when we decided it, and is left untouched on a
 * call already closed so the first-closed time survives.
 */

import { prisma } from "../db/tenancy";

export async function closeExpiredGrants(now: Date = new Date()): Promise<number> {
  const result = await prisma.grant.updateMany({
    where: {
      deadlineIsKnown: true,
      deadline: { lt: now },
      status: { not: "CLOSED" },
    },
    data: { status: "CLOSED", closedSeenAt: now },
  });
  return result.count;
}
