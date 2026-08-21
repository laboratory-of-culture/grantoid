/**
 * Turning classified items into Grant records.
 *
 * Runs after classification: only items already judged to be funding calls get
 * here, and the agent may still overturn that once it has the full page rather
 * than the headline.
 *
 * What this stage cannot do is the point of it. An aggregator announcement is a
 * notice pointing at the donor's own call; the eligibility clauses usually live
 * in a PDF on the donor's site, and that PDF is read later, when an organization
 * is actually working on an application. So every record written here is
 * incomplete by construction — and the job is to make the incompleteness
 * *visible*, so an UNCERTAIN verdict caused by a thin grant record does not look
 * like an UNCERTAIN caused by an unanswered profile question. They call for
 * opposite actions: open the original announcement, versus fill in your profile.
 */

import { createHash } from "node:crypto";

import { extractGrant } from "../../agents/extraction";
import { articleText } from "./article";
import { politeFetch } from "./fetch";
import { stripRubric } from "./discover";
import { statusForDeadline } from "../schemas/grant";
import { prisma } from "../db/tenancy";

export type ExtractionOutcome = {
  examined: number;
  extracted: number;
  /** The agent read the full page and disagreed with the headline. */
  rejected: number;
  failed: number;
  durationMs: number;
  errors: { title: string; url: string; error: string }[];
};

/**
 * A stable slug for a rule, so re-extracting a grant updates rules rather than
 * duplicating them.
 *
 * Prefers the profile field the rule resolves, because that is stable across
 * rewordings; falls back to a hash of the text, which is not stable across
 * rewordings but is at least stable across identical re-runs.
 */
export function ruleKey(
  resolvingFactKey: string | null,
  text: string,
  index: number,
): string {
  if (resolvingFactKey) return resolvingFactKey.replace(/_/g, "-");
  const digest = createHash("sha256").update(text.trim().toLowerCase()).digest("hex").slice(0, 8);
  return `rule-${index}-${digest}`;
}

/** Deduplicated, because two rules can resolve the same profile field. */
function uniqueKeys(
  rules: { resolvingFactKey: string | null; text: string }[],
): string[] {
  const seen = new Map<string, number>();
  return rules.map((rule, i) => {
    const base = ruleKey(rule.resolvingFactKey, rule.text, i);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  });
}

async function extractOne(item: {
  id: string;
  url: string;
  title: string;
  externalId: string;
  sourceId: string;
  source: { name: string; userAgent: string | null; rateLimitPerMin: number };
}): Promise<"extracted" | "rejected" | "failed"> {
  const response = await politeFetch(item.url, {
    userAgent: item.source.userAgent ?? undefined,
    rateLimitPerMin: item.source.rateLimitPerMin,
  });

  if (response.status !== 200) {
    await prisma.sourceItem.update({
      where: { id: item.id },
      data: {
        status: "FAILED",
        statusNote: `сторінка недоступна: HTTP ${response.status}`,
        checkedAt: new Date(),
      },
    });
    return "failed";
  }

  const article = articleText(response.body);
  // The portal's rubric label comes off here and not before: the classifier
  // needed it, this agent does not, and leaving it on made the model echo
  // «ГРАНТ Гранти на розвиток…» into the stored title of the call.
  const run = await extractGrant(
    article.text,
    item.url,
    stripRubric(item.title),
    article.truncated,
  );

  if (!run.result) {
    await prisma.sourceItem.update({
      where: { id: item.id },
      data: {
        status: "FAILED",
        statusNote: `не вдалося розібрати: ${run.error ?? "невідома помилка"}`,
        checkedAt: new Date(),
      },
    });
    return "failed";
  }

  // The classifier saw a headline; this agent saw the page. When they disagree,
  // the one that read more wins.
  if (!run.result.isGrant) {
    await prisma.sourceItem.update({
      where: { id: item.id },
      data: {
        status: "NOT_GRANT",
        statusNote: "повний текст показав, що це не грантовий конкурс",
        checkedAt: new Date(),
      },
    });
    return "rejected";
  }

  const g = run.result;
  const now = new Date();
  const keys = uniqueKeys(g.eligibility);
  const contentHash = createHash("sha256").update(article.text).digest("hex");

  const grant = await prisma.grant.upsert({
    where: { sourceId_externalKey: { sourceId: item.sourceId, externalKey: item.externalId } },
    create: {
      sourceId: item.sourceId,
      externalKey: item.externalId,
      title: g.titleUk,
      titleUk: g.titleUk,
      // The aggregator is not the donor, but an unnamed donor is worse than a
      // named aggregator for someone deciding whether to open the link.
      donorName: g.donorName ?? item.source.name,
      sourceUrl: item.url,
      applicationUrl: g.applicationUrl,
      status: statusForDeadline(g.deadline ? new Date(g.deadline) : null),
      deadline: g.deadline ? new Date(g.deadline) : null,
      deadlineIsKnown: g.deadline !== null,
      fundingMin: g.fundingMin,
      fundingMax: g.fundingMax,
      currency: g.currency,
      cofinancingRequired: g.cofinancingRequired,
      applicantTypes: g.applicantTypes,
      applicantGeography: g.applicantGeography,
      sectors: g.sectors,
      themes: [],
      targetGroups: g.targetGroups,
      extractionConfidence: run.confidence,
      // Newline-separated, not "; ": a note is prose and prose contains
      // semicolons. The first live render split "Every field is stated; nothing
      // is unread." into two broken fragments.
      extractionNotes: run.notes.join("\n"),
      contentHash,
      retrievedAt: now,
      lastCheckedAt: now,
      rules: {
        create: g.eligibility.map((rule, i) => ({
          key: keys[i] ?? `rule-${i}`,
          text: rule.text,
          textUk: rule.text,
          kind: rule.kind,
          orderIndex: i,
          resolvingFactKey: rule.resolvingFactKey,
          citations: {
            create: [{ quote: rule.quote, url: item.url, retrievedAt: now }],
          },
        })),
      },
    },
    update: {
      title: g.titleUk,
      titleUk: g.titleUk,
      donorName: g.donorName ?? item.source.name,
      applicationUrl: g.applicationUrl,
      status: statusForDeadline(g.deadline ? new Date(g.deadline) : null),
      deadline: g.deadline ? new Date(g.deadline) : null,
      deadlineIsKnown: g.deadline !== null,
      fundingMin: g.fundingMin,
      fundingMax: g.fundingMax,
      currency: g.currency,
      cofinancingRequired: g.cofinancingRequired,
      applicantTypes: g.applicantTypes,
      applicantGeography: g.applicantGeography,
      sectors: g.sectors,
      targetGroups: g.targetGroups,
      extractionConfidence: run.confidence,
      // Newline-separated, not "; ": a note is prose and prose contains
      // semicolons. The first live render split "Every field is stated; nothing
      // is unread." into two broken fragments.
      extractionNotes: run.notes.join("\n"),
      contentHash,
      lastCheckedAt: now,
    },
  });

  await prisma.sourceItem.update({
    where: { id: item.id },
    data: {
      status: "EXTRACTED",
      grantId: grant.id,
      statusNote:
        run.droppedRules.length > 0
          ? `${run.droppedRules.length} правил відкинуто — цитат не знайдено на сторінці`
          : null,
      checkedAt: now,
    },
  });

  return "extracted";
}

export async function extractPending(limit = 20): Promise<ExtractionOutcome> {
  const started = Date.now();
  const items = await prisma.sourceItem.findMany({
    where: { status: "GRANT" },
    orderBy: { discoveredAt: "asc" },
    take: limit,
    include: {
      source: { select: { name: true, userAgent: true, rateLimitPerMin: true } },
    },
  });

  const outcome: ExtractionOutcome = {
    examined: items.length,
    extracted: 0,
    rejected: 0,
    failed: 0,
    durationMs: 0,
    errors: [],
  };

  for (const item of items) {
    try {
      const result = await extractOne(item);
      outcome[result] += 1;
    } catch (err) {
      // One unreachable page must not abandon the rest of the queue.
      outcome.failed += 1;
      outcome.errors.push({ title: item.title, url: item.url, error: String(err) });
      await prisma.sourceItem.update({
        where: { id: item.id },
        data: { status: "FAILED", statusNote: String(err).slice(0, 500), checkedAt: new Date() },
      });
    }
  }

  outcome.durationMs = Date.now() - started;
  return outcome;
}
