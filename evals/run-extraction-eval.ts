/**
 * The #3 regression eval: non-requirements must not become eligibility rules.
 *
 *   npx tsx evals/run-extraction-eval.ts
 *
 * Runs the extraction agent over each fixture announcement and checks both
 * directions — the misextracted `bad` quote is gone, the genuine `good`
 * requirement stays. Kept separate from the eligibility eval because it exercises
 * a different agent: extraction (think off, D7), not the eligibility ladder.
 *
 * A run here is the gate on any change to `agents/extraction/prompt.md`, the same
 * way `run-eval.ts` gates the eligibility prompt. Fixtures live in
 * `evals/fixtures/extraction/`.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { parse } from "yaml";
import { z } from "zod";

import { extractGrant, quoteOccursIn } from "../agents/extraction";
import { checkRuntime } from "../packages/llm/ollama";

const Case = z.object({
  id: z.string(),
  grant: z.string(),
  bad: z.string(),
  good: z.string(),
  was_mapped_to: z.string().optional(),
  article: z.string(),
});
const Fixtures = z.object({ cases: z.array(Case) });

async function main(): Promise<void> {
  await checkRuntime();
  const file = path.join(process.cwd(), "evals/fixtures/extraction/misextracted-rules.yaml");
  const { cases } = Fixtures.parse(parse(readFileSync(file, "utf8")));

  console.log(`extraction eval — ${cases.length} cases\n`);
  let pass = 0;
  for (const c of cases) {
    const run = await extractGrant(c.article, `https://example.org/${c.id}`, c.article.split("\n")[0]!);
    const rules = run.result?.eligibility ?? [];
    // `quoteOccursIn` normalises whitespace and punctuation, so a rule that
    // paraphrases the same span still counts as extracting it.
    const has = (needle: string) =>
      rules.some((r) => quoteOccursIn(needle, r.quote) || quoteOccursIn(r.quote, needle));
    const badGone = !has(c.bad);
    const goodKept = has(c.good);
    const ok = badGone && goodKept;
    if (ok) pass += 1;
    console.log(
      `${ok ? "ok  " : "MISS"} ${c.id.padEnd(20)} bad-dropped=${badGone} good-kept=${goodKept}` +
        `  (${rules.length} rules)`,
    );
    if (!ok) for (const r of rules) console.log(`       rule: ${r.quote.slice(0, 72)}`);
  }

  console.log(`\n${pass}/${cases.length} pass`);
  if (pass < cases.length) process.exit(1);
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
