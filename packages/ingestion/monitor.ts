/**
 * Running discovery against a registered source and recording what came back.
 *
 * The monitor never decides what an item *is* — it only records that the source
 * announced it. Classification and extraction are separate stages, so that a
 * change in how we judge items never requires re-crawling anyone's site.
 */

import type { Prisma, Source } from "@prisma/client";

import { prisma } from "../db/tenancy";
import { DEFAULT_USER_AGENT, robotsAllows } from "./fetch";
import { DiscoveryFailed, discover } from "./discover";

export type MonitorResult = {
  sourceId: string;
  sourceName: string;
  found: number;
  added: number;
  changed: number;
  unchanged: number;
  error: string | null;
  durationMs: number;
};

/** ГУРТ's article paths. Configured here rather than in the database because it
 *  is parser code, not operator configuration. */
const LINK_PATTERNS: Record<string, RegExp> = {
  "gurt.org.ua": /\/news\/grants\/\d+\//,
};

function linkPatternFor(source: Source): RegExp | undefined {
  try {
    return LINK_PATTERNS[new URL(source.homepageUrl).host.replace(/^www\./, "")];
  } catch {
    return undefined;
  }
}

/**
 * Check one source.
 *
 * Refuses to run against a source that is disabled or unreviewed. The database
 * enforces that an enabled source has been reviewed; this refuses to reach a
 * site at all until someone has said it may be reached.
 */
export async function monitorSource(sourceId: string): Promise<MonitorResult> {
  const started = Date.now();
  const source = await prisma.source.findUniqueOrThrow({ where: { id: sourceId } });

  const base: MonitorResult = {
    sourceId: source.id,
    sourceName: source.name,
    found: 0,
    added: 0,
    changed: 0,
    unchanged: 0,
    error: null,
    durationMs: 0,
  };

  const fail = async (message: string): Promise<MonitorResult> => {
    await prisma.source.update({
      where: { id: source.id },
      data: { lastCrawledAt: new Date(), lastError: message },
    });
    return { ...base, error: message, durationMs: Date.now() - started };
  };

  if (!source.enabled) return fail("Джерело вимкнене.");
  if (!source.discoveryUrl) return fail("Не вказано адресу для перегляду.");
  if (!source.robotsCheckedAt || !source.tosReviewedAt) {
    return fail("Джерело не перевірене: потрібно переглянути robots.txt і умови використання.");
  }

  let items;
  try {
    items = await discover({
      discovery: source.discovery,
      discoveryUrl: source.discoveryUrl,
      userAgent: source.userAgent ?? DEFAULT_USER_AGENT,
      rateLimitPerMin: source.rateLimitPerMin,
      linkPattern: linkPatternFor(source),
    });
  } catch (err) {
    return fail(err instanceof DiscoveryFailed ? err.message : String(err));
  }

  const existing = await prisma.sourceItem.findMany({
    where: {
      sourceId: source.id,
      externalId: { in: items.map((i) => i.externalId) },
    },
    select: { externalId: true, contentHash: true },
  });
  const hashById = new Map(existing.map((e) => [e.externalId, e.contentHash]));

  let added = 0;
  let changed = 0;
  let unchanged = 0;

  for (const item of items) {
    const previous = hashById.get(item.externalId);
    if (previous === undefined) {
      added += 1;
    } else if (previous !== item.contentHash) {
      changed += 1;
    } else {
      unchanged += 1;
      // Nothing to write beyond the check time.
      await prisma.sourceItem.update({
        where: { sourceId_externalId: { sourceId: source.id, externalId: item.externalId } },
        data: { checkedAt: new Date() },
      });
      continue;
    }

    const data: Prisma.SourceItemUncheckedCreateInput = {
      sourceId: source.id,
      externalId: item.externalId,
      url: item.url,
      title: item.title,
      summary: item.summary,
      publishedAt: item.publishedAt,
      contentHash: item.contentHash,
      checkedAt: new Date(),
    };

    await prisma.sourceItem.upsert({
      where: { sourceId_externalId: { sourceId: source.id, externalId: item.externalId } },
      create: data,
      // A re-announcement with edited text goes back into the queue: the change
      // may be the deadline, and a stale classification would hide that.
      update: {
        url: item.url,
        title: item.title,
        summary: item.summary,
        publishedAt: item.publishedAt,
        contentHash: item.contentHash,
        checkedAt: new Date(),
        status: "NEW",
        statusNote: null,
      },
    });
  }

  await prisma.source.update({
    where: { id: source.id },
    data: { lastCrawledAt: new Date(), lastError: null },
  });

  return {
    ...base,
    found: items.length,
    added,
    changed,
    unchanged,
    durationMs: Date.now() - started,
  };
}

/**
 * How much early a crawl still counts as due.
 *
 * The nightly chain fires at a fixed wall-clock time (04:00). A strict
 * "elapsed >= cadence" gate then degrades to every *other* night: the moment one
 * run lands a few seconds late — or an off-schedule crawl (a manual test, a
 * catch-up after downtime) re-anchors `lastCrawledAt` to some daytime hour — the
 * next 04:00 is a little under 24h later and the source is skipped until the run
 * after that. A 24h source would then refresh once every 48h, which is exactly
 * the "sources haven't updated in two days" symptom.
 *
 * Three hours of slack lets a daily job clear a 24h cadence every night while
 * keeping the real interval well above the politeness floor (worst case ~21h).
 *
 * Capped at an eighth of the cadence, because `crawlCadenceHours` is per-source
 * and an operator may set a short one. A flat three hours against a 3h cadence
 * is a threshold of zero and against a 2h cadence it is negative — the source
 * would come up due on every single pass, which is the politeness budget turned
 * off rather than widened. The cap keeps the slack proportional: 3h on a daily
 * source, 15 minutes on a two-hourly one.
 */
const CADENCE_GRACE_MS = 3 * 3_600_000;

export function dueAfterMs(crawlCadenceHours: number): number {
  const cadence = crawlCadenceHours * 3_600_000;
  return cadence - Math.min(CADENCE_GRACE_MS, cadence / 8);
}

/** Check every source whose cadence has elapsed (within the grace window). */
export async function monitorDue(): Promise<MonitorResult[]> {
  const sources = await prisma.source.findMany({ where: { enabled: true } });
  const now = Date.now();

  const due = sources.filter(
    (s) =>
      s.lastCrawledAt === null ||
      now - s.lastCrawledAt.getTime() >= dueAfterMs(s.crawlCadenceHours),
  );

  const results: MonitorResult[] = [];
  // Sequential on purpose: two sources checked at once is two simultaneous
  // requests to small portals, and the politeness budget is per host.
  for (const source of due) results.push(await monitorSource(source.id));
  return results;
}

/**
 * Record a robots.txt review for a source.
 *
 * Separate from enabling: reviewing tells you whether you may, enabling is
 * deciding to. Keeping them apart is what makes the enabled-implies-reviewed
 * constraint meaningful rather than a box someone ticks on the way past.
 */
export async function reviewRobots(sourceId: string): Promise<{ allowed: boolean; note: string }> {
  const source = await prisma.source.findUniqueOrThrow({ where: { id: sourceId } });
  const path = source.discoveryUrl ? new URL(source.discoveryUrl).pathname : "/";
  const result = await robotsAllows(
    source.homepageUrl,
    path,
    source.userAgent ?? DEFAULT_USER_AGENT,
  );

  await prisma.source.update({
    where: { id: sourceId },
    data: { robotsCheckedAt: new Date(), robotsAllows: result.allowed },
  });

  return result;
}
