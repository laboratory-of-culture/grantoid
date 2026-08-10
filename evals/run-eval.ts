/**
 * Runs the eligibility agent across the golden set and prints the report.
 *
 *   npm run eval                 # defaults from .env
 *   npm run eval -- --think      # let qwen3 reason before answering
 *   GRANT_AI_MODEL=llama3 npm run eval
 *
 * Every run records model tag, num_ctx, seed, think and the prompt fingerprint,
 * so a score movement attributes to the thing that changed. A score from a
 * different tag or fingerprint is not a baseline — it is a different experiment.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { assess, promptFingerprint } from "../agents/eligibility";
import { checkRuntime, MODEL, NUM_CTX, SEED } from "../packages/llm/ollama";
import { formatReport, report, scorePair, type PairOutcome } from "../packages/evaluation/metrics";
import { loadAll } from "./load";

const think = process.argv.includes("--think");

async function main(): Promise<void> {
  await checkRuntime();

  const { grants, organizations, labels } = loadAll();
  const grantById = new Map(grants.map((g) => [g.id, g]));
  const orgById = new Map(organizations.map((o) => [o.id, o]));

  console.log(`model      ${MODEL}`);
  console.log(`num_ctx    ${NUM_CTX}`);
  console.log(`seed       ${SEED}`);
  console.log(`think      ${think}`);
  console.log(`prompt     ${promptFingerprint()}`);
  console.log(`pairs      ${labels.length}\n`);

  const outcomes: PairOutcome[] = [];
  /** How often the model reached past its evidence and had to be constrained. */
  let corrections = 0;

  for (const label of labels) {
    const grant = grantById.get(label.grant)!;
    const org = orgById.get(label.org)!;

    process.stdout.write(`  ${label.org} × ${label.grant} … `);

    const run = await assess(org, grant, { think });

    // Everything the grant's citations were read from, for the verbatim check.
    const grantText = [
      ...grant.eligibility.map((r) => `${r.text} ${r.textUk ?? ""} ${r.citation?.quote ?? ""}`),
      grant.extractionNotes ?? "",
    ].join("\n");

    const goldCriteria = Object.fromEntries(
      Object.entries(label.criteria).map(([k, v]) => [k, v.verdict]),
    );

    const outcome = scorePair({
      org: label.org,
      grant: label.grant,
      goldOverall: label.overall,
      goldRecommend: label.recommend,
      goldCriteria,
      result: run.result,
      grantText,
      error: run.error,
      latencyMs: run.usage.latencyMs,
      promptTokens: run.usage.promptTokens,
      outputTokens: run.usage.outputTokens,
    });
    outcomes.push(outcome);

    const verdict = outcome.predOverall ?? "—";
    const mark = outcome.predOverall === outcome.goldOverall ? "ok " : "MISS";
    console.log(
      `${mark} ${verdict} (gold ${label.overall})  ` +
        `${(run.usage.latencyMs / 1000).toFixed(1)}s  ${run.usage.promptTokens}p/${run.usage.outputTokens}o` +
        (run.corrections.length > 0 ? `  ${run.corrections.length} corrected` : "") +
        (run.error ? `  [${run.error.slice(0, 80)}]` : ""),
    );
    for (const c of run.corrections) {
      console.log(`         ${c.ruleKey}: ${c.from} → ${c.to}  (${c.reason})`);
    }
    corrections += run.corrections.length;
  }

  const r = report(outcomes);
  console.log(`\n${formatReport(r)}`);
  console.log(
    `\n  evidence constraints   ${corrections} verdict(s) corrected after generation`,
  );

  const dir = path.join(process.cwd(), "evals", "results");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `${stamp}_${MODEL.replace(/[:/]/g, "-")}.json`);
  writeFileSync(
    file,
    JSON.stringify(
      { model: MODEL, numCtx: NUM_CTX, seed: SEED, think, promptFingerprint: promptFingerprint(), report: r, outcomes },
      null,
      2,
    ),
  );
  console.log(`\nwritten to ${path.relative(process.cwd(), file)}`);

  // Misses are information, not a build failure — this is a research harness,
  // not a gate. The gate lives in CI against a recorded baseline.
  if (r.failed === outcomes.length) {
    console.error("\nevery pair failed to produce usable output");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
