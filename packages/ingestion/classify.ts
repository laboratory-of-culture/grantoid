/**
 * Running classification over discovered items.
 *
 * Rules first, agent for the rest, and a person for anything the agent is not
 * confident about. The order matters for cost as much as for correctness: on the
 * two live sources roughly half the items are settled by a leading marker, and
 * those are the ones a model would also get right — so paying for them buys
 * nothing.
 */

import { classify, CONFIDENCE_FLOOR } from "../../agents/classifier";
import { classifyByRule } from "./classify-rules";
import { prisma } from "../db/tenancy";

export type ClassifyResult = {
  examined: number;
  grants: number;
  rejected: number;
  /** Left NEW because the agent was not confident enough to decide alone. */
  deferred: number;
  failed: number;
  byRule: number;
  byAgent: number;
  durationMs: number;
};

/**
 * Classify every item still marked NEW.
 *
 * `limit` exists because the agent runs on local hardware and a backlog should
 * not become a single unbounded job — see the capacity note in model-runtime.
 */
export async function classifyPending(limit = 50): Promise<ClassifyResult> {
  const started = Date.now();

  const items = await prisma.sourceItem.findMany({
    where: { status: "NEW" },
    orderBy: { discoveredAt: "desc" },
    take: limit,
    include: { source: { select: { name: true } } },
  });

  const result: ClassifyResult = {
    examined: items.length,
    grants: 0,
    rejected: 0,
    deferred: 0,
    failed: 0,
    byRule: 0,
    byAgent: 0,
    durationMs: 0,
  };

  for (const item of items) {
    const rule = classifyByRule(item.title);

    if (rule) {
      result.byRule += 1;
      await prisma.sourceItem.update({
        where: { id: item.id },
        data: { status: rule.status, statusNote: rule.note },
      });
      if (rule.status === "GRANT") result.grants += 1;
      else result.rejected += 1;
      continue;
    }

    const run = await classify(item.title, item.summary, item.source.name);
    result.byAgent += 1;

    if (!run.result) {
      result.failed += 1;
      await prisma.sourceItem.update({
        where: { id: item.id },
        data: { status: "FAILED", statusNote: run.error ?? "класифікатор не відповів" },
      });
      continue;
    }

    const { isGrant, confidence, reason, category } = run.result;

    // An unconfident answer is left NEW rather than filed. Both mistakes cost,
    // and neither is worth making automatically on a coin flip.
    if (confidence < CONFIDENCE_FLOOR) {
      result.deferred += 1;
      await prisma.sourceItem.update({
        where: { id: item.id },
        data: {
          statusNote:
            `Потрібне рішення людини (впевненість ${confidence.toFixed(2)}): ${reason}`,
        },
      });
      continue;
    }

    if (isGrant) {
      result.grants += 1;
      await prisma.sourceItem.update({
        where: { id: item.id },
        data: { status: "GRANT", statusNote: reason },
      });
    } else {
      result.rejected += 1;
      await prisma.sourceItem.update({
        where: { id: item.id },
        // The constraint requires a note on a rejection: without it a low grant
        // count is indistinguishable from a broken classifier.
        data: { status: "NOT_GRANT", statusNote: `${category}: ${reason}` },
      });
    }
  }

  result.durationMs = Date.now() - started;
  return result;
}
