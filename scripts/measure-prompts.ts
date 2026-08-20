/**
 * How many tokens each agent's prompt actually costs.
 *
 *   npx tsx scripts/measure-prompts.ts
 *
 * Measured, not estimated: the prompt is built exactly as the agent builds it
 * and sent to the model with `num_predict: 1`, so `prompt_eval_count` is the
 * real number. Guessing at token counts from character length is how a
 * "saving" turns out to be noise.
 */

import { Ollama } from "ollama";

import { systemPrompt as eligibilitySystem, userPrompt as eligibilityUser } from "../agents/eligibility";
import { systemPrompt as conceptSystem, userPrompt as conceptUser } from "../agents/concept";
import { systemPrompt as assistantSystem, userPrompt as assistantUser } from "../agents/assistant";
import { systemPrompt as classifierSystem, userPrompt as classifierUser } from "../agents/classifier";
import { CONCEPT_SECTIONS } from "../packages/schemas/concept";
import { MAX_DONOR_CHARS, donorMaterial } from "../packages/db/donor-docs";
import { toGrant, toProfile } from "../packages/matching/adapters";
import { prisma } from "../packages/db/tenancy";

const MODEL = process.env.GRANT_AI_MODEL ?? "qwen3:4b";
const ollama = new Ollama({ host: process.env.OLLAMA_HOST ?? "http://localhost:11434" });

async function tokens(system: string, user: string): Promise<number> {
  const res = await ollama.generate({
    model: MODEL,
    system,
    prompt: user,
    stream: false,
    think: false,
    options: { num_predict: 1, num_ctx: 32768 },
  });
  return res.prompt_eval_count ?? -1;
}

async function main(): Promise<void> {
  const org = await prisma.organization.findFirstOrThrow({
    include: { facts: { include: { citations: true } } },
  });
  const grant = await prisma.grant.findFirstOrThrow({
    where: { synthetic: false },
    include: { rules: { include: { citations: true } } },
  });

  const profile = toProfile(org);
  const call = toGrant(grant);
  const donor = await donorMaterial(org.id, grant.id);

  const rows: { agent: string; tokens: number }[] = [];

  rows.push({
    agent: "classifier",
    tokens: await tokens(
      classifierSystem(),
      classifierUser(grant.title, "Короткий опис оголошення.", "ГУРТ"),
    ),
  });

  rows.push({
    agent: "eligibility",
    tokens: await tokens(eligibilitySystem(), eligibilityUser(profile, call)),
  });

  rows.push({
    agent: "concept (8 sections)",
    tokens: await tokens(
      conceptSystem(),
      conceptUser(profile, call, CONCEPT_SECTIONS, donor.text),
    ),
  });

  rows.push({
    agent: "assistant (1 section)",
    tokens: await tokens(
      assistantSystem(),
      assistantUser({
        org: profile,
        grant: call,
        sectionKey: "problem",
        current: "У Чернівецькій області існують обмежені можливості для збереження спадщини.",
        instruction: "Скоротити вдвічі",
        donorText: donor.text,
        edited: false,
      }),
    ),
  });

  // The case that actually costs: a donor PDF is uploaded. Simulated rather than
  // requiring one, so the number is reproducible on a fresh install — and this
  // is the scenario the assistant's budget exists for.
  const fakeDonor = "Умови конкурсу. Співфінансування 20%. ".repeat(600)
    .slice(0, MAX_DONOR_CHARS);

  rows.push({
    agent: "concept + donor PDF",
    tokens: await tokens(
      conceptSystem(),
      conceptUser(profile, call, CONCEPT_SECTIONS, fakeDonor),
    ),
  });

  rows.push({
    agent: "assistant + donor PDF",
    tokens: await tokens(
      assistantSystem(),
      assistantUser({
        org: profile,
        grant: call,
        sectionKey: "problem",
        current: "У Чернівецькій області існують обмежені можливості для збереження спадщини.",
        instruction: "Скоротити вдвічі",
        donorText: fakeDonor,
        edited: false,
      }),
    ),
  });

  const width = Math.max(...rows.map((r) => r.agent.length));
  for (const row of rows) {
    console.log(`${row.agent.padEnd(width)}  ${String(row.tokens).padStart(6)} tokens`);
  }
  console.log(`\nдонорських документів прочитано: ${donor.readable.length}`);
  console.log(`num_ctx у конфігурації: ${process.env.GRANT_AI_NUM_CTX ?? 16384}\n`);
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
