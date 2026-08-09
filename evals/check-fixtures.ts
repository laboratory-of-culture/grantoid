/**
 * Loads the golden set, validates it, and reports what it covers.
 *
 * Run in CI. A fixture that stops parsing is a schema change nobody propagated;
 * a coverage gap is a claim the eval can no longer check.
 */

import { loadAll } from "./load";
import { FACT_KEYS } from "../packages/schemas/fact-registry";
import { Verdict } from "../packages/schemas/verdict";

function main(): void {
  const { grants, organizations, labels } = loadAll();

  console.log(`grants          ${grants.length}`);
  console.log(`organizations   ${organizations.length}`);
  console.log(`labelled pairs  ${labels.length} of ${grants.length * organizations.length}`);

  const real = grants.filter((g) => !g.synthetic).length;
  console.log(`  real calls    ${real}`);
  console.log(`  synthetic     ${grants.length - real}`);

  console.log("\nverdict spread across labelled pairs");
  for (const v of Verdict.options) {
    const n = labels.filter((l) => l.overall === v).length;
    const bar = "#".repeat(n);
    console.log(`  ${v.padEnd(20)} ${String(n).padStart(2)} ${bar}`);
  }

  const recommended = labels.filter((l) => l.recommend).length;
  console.log(`\nrecommended     ${recommended} of ${labels.length}`);

  // Coverage checks. These are the ways a golden set quietly stops testing
  // anything while still passing.
  const problems: string[] = [];

  const covered = new Set(labels.map((l) => `${l.org}|${l.grant}`));
  for (const o of organizations) {
    for (const g of grants) {
      if (!covered.has(`${o.id}|${g.id}`)) {
        problems.push(`unlabelled pair: ${o.id} x ${g.id}`);
      }
    }
  }

  const labelledVerdicts = new Set(labels.map((l) => l.overall));
  if (!labelledVerdicts.has("UNCERTAIN")) {
    problems.push(
      "no pair is labelled UNCERTAIN — the set cannot detect a model that " +
        "collapses unknowns into a definite verdict, which is the failure this " +
        "product most needs to catch",
    );
  }
  if (!labelledVerdicts.has("NOT_ELIGIBLE")) {
    problems.push("no pair is labelled NOT_ELIGIBLE — hard blockers are untested");
  }

  // At least one profile must leave a gating fact unanswered, or the
  // unknown-is-not-no rule is never exercised.
  const hasUnknownGatingFact = organizations.some((o) =>
    o.facts.some((f) => f.state === "UNKNOWN"),
  );
  if (!hasUnknownGatingFact) {
    problems.push("every profile is fully answered — UNCERTAIN is unreachable");
  }

  const hasExplicitNegative = organizations.some((o) =>
    o.facts.some((f) => f.state === "EXPLICIT_NEGATIVE"),
  );
  if (!hasExplicitNegative) {
    problems.push(
      "no profile carries an EXPLICIT_NEGATIVE — NOT_ELIGIBLE cannot be " +
        "legitimately reached by any pair",
    );
  }

  const unknownCounts = organizations.map(
    (o) => `${o.id}: ${o.facts.filter((f) => f.state === "UNKNOWN").length}/${FACT_KEYS.length} unanswered`,
  );
  console.log("\nprofile gaps");
  for (const line of unknownCounts) console.log(`  ${line}`);

  if (problems.length > 0) {
    console.error("\nproblems");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  console.log("\nfixtures OK");
}

main();
