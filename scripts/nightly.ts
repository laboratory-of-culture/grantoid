/**
 * The whole nightly chain, in the order it has to happen.
 *
 *   npx tsx scripts/nightly.ts
 *
 * Four steps existed and no way to run them together: monitoring found items,
 * classification judged them, extraction turned the survivors into calls, and
 * matching assessed the calls against each organization. Every one had its own
 * script, which is fine for debugging one stage and useless as the thing a cron
 * entry points at — and `docs/DEPLOY.md` tells an operator to schedule exactly
 * this. Running them out of order silently does nothing: classification with
 * nothing discovered examines zero items and reports success.
 *
 * Sequential and one at a time on purpose. Both source portals are small, the
 * politeness budget is per host, and the model serves one request at a time
 * anyway — parallelism here buys nothing and costs goodwill.
 *
 * Every organization gets a feed, not just the demo one. That is the actual
 * nightly job; `build-feed.ts` remains the way to redo one of them by hand.
 */

import { ensureFactRows } from "../packages/db/facts";
import { classifyPending } from "../packages/ingestion/classify";
import { closeExpiredGrants } from "../packages/ingestion/expiry";
import { coreFactStatus } from "../packages/schemas/fact-registry";
import { extractPending } from "../packages/ingestion/extract";
import { monitorDue } from "../packages/ingestion/monitor";
import { checkRuntime } from "../packages/llm/ollama";
import { prisma } from "../packages/db/tenancy";
import { matchOrganization } from "../packages/matching/run";

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

async function main(): Promise<void> {
  await checkRuntime();
  const started = Date.now();

  // First, because everything downstream reads a profile and a profile with a
  // missing registry row is rejected rather than defaulted. A deploy that adds
  // a field would otherwise break matching for every organization that already
  // existed, and only for those.
  const rows = await ensureFactRows();
  if (rows.added > 0) {
    console.log(`— профілі: додано ${rows.added} порожніх рядків у ${rows.organizations} організацій
`);
  }

  console.log("— джерела");
  const monitored = await monitorDue();
  if (monitored.length === 0) {
    console.log("  жодне джерело не настало за розкладом");
  }
  for (const m of monitored) {
    console.log(
      `  ${m.sourceName.padEnd(24)} знайдено ${m.found}, нових ${m.added}, змінених ${m.changed}` +
        `  ${seconds(m.durationMs)}${m.error ? `  ПОМИЛКА: ${m.error}` : ""}`,
    );
  }

  console.log("\n— класифікація");
  const classified = await classifyPending(200);
  console.log(
    `  оглянуто ${classified.examined}, гранти ${classified.grants}, не гранти ${classified.rejected}, ` +
      // Deferred is the one worth reading: the classifier was not confident
      // enough to decide, so the item stays NEW and comes back tomorrow. A
      // number that only grows means the rules need a case they do not cover.
      `відкладено ${classified.deferred}, помилок ${classified.failed}` +
      `  (правилами ${classified.byRule}, моделлю ${classified.byAgent})  ${seconds(classified.durationMs)}`,
  );

  console.log("\n— витягування конкурсів");
  const extracted = await extractPending(50);
  console.log(
    `  оглянуто ${extracted.examined}, створено ${extracted.extracted}, ` +
      `відхилено ${extracted.rejected}, помилок ${extracted.failed}  ${seconds(extracted.durationMs)}`,
  );

  // Before matching, not after: an expired call closed here is one the match
  // pass then skips as CLOSED rather than re-filtering by its deadline for every
  // organisation.
  console.log("\n— закриття прострочених");
  const closed = await closeExpiredGrants();
  console.log(`  закрито ${closed}`);

  console.log("\n— стрічки організацій");
  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true, facts: { where: { state: { not: "UNKNOWN" } }, select: { key: true } } },
    orderBy: { name: "asc" },
  });
  let skippedThin = 0;
  for (const org of organizations) {
    // The completeness gate. An organisation below the core-fact threshold
    // cannot be ruled in or out of anything — it only produces UNCERTAIN, at
    // ~3 minutes of model time each, and it gets a fill-your-profile nudge from
    // the digest rather than a feed. Assessing it is spending the one GPU on a
    // verdict nobody can act on, so skip it until it answers enough to match.
    if (!coreFactStatus(org.facts.map((f) => f.key)).ready) {
      skippedThin += 1;
      continue;
    }
    // Isolated per organisation on purpose. Matching reads the shared grant
    // pool, so one malformed grant used to throw inside `matchOrganization` and
    // — with no guard here — abort the whole loop, leaving every organisation
    // after it in the alphabet unmatched and their digests empty. A failure now
    // costs the one organisation its run, not everyone else theirs.
    try {
      const outcome = await matchOrganization(org.id, { limit: 200 });
      console.log(
        `  ${org.name}\n    кандидатів ${outcome.candidates}, відсіяно без моделі ${outcome.filtered}, ` +
          `повторно ${outcome.reused}, оцінено ${outcome.assessed}, помилок ${outcome.failed}, ` +
          `рекомендовано ${outcome.recommended}  ${seconds(outcome.durationMs)}`,
      );
    } catch (err) {
      console.log(`  ${org.name}\n    ПОМИЛКА: ${String(err).replace(/\s+/g, " ").slice(0, 200)}`);
    }
  }
  if (skippedThin > 0) {
    console.log(`  (пропущено ${skippedThin} — профіль неповний, отримають заохочення)`);
  }

  console.log(`\nразом ${seconds(Date.now() - started)}`);
}

main()
  // Explicit exit, or the process lingers for hours after the work is done: the
  // ollama client keeps a keep-alive socket open, and an open handle is enough
  // to hold node — and with it a Prisma connection out of a pool of five. A
  // finished nightly that never exits is a connection the app cannot have.
  .catch((err) => {
    console.error(String(err));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect())
  .then(() => process.exit());
