/**
 * The weekly product-signals report — the feedback loop from real use.
 *
 *   npm run feedback
 *
 * Everything a pilot with real organisations already tells us about where the
 * product is weak, read out of the data we hold rather than from anything sent
 * anywhere. No tracking, no pixels, no per-organisation values or document
 * contents — only counts, rates and fact keys, which is what improves a prompt,
 * a question or a screen. The three sections map to the three levers:
 *
 *   - Prompts:  how often a person corrected the agent, and on which fact.
 *   - UI:       which questions people skip, weighted by what they unlock.
 *   - Product:  the recommendation rate, and where the feed goes quiet.
 *
 * `pii-and-donor-data`: this is operator analytics over aggregates. It names
 * fact keys and totals, never a value a person typed or a document they
 * uploaded, so a leak of this report is a leak of nothing an organisation owns.
 */

import { FACT_KEYS, factDefinition, coreFactStatus } from "../packages/schemas/fact-registry";
import { factImpact } from "../packages/db/impact";
import { prisma } from "../packages/db/tenancy";

function pct(n: number, d: number): string {
  return d === 0 ? "  —" : `${Math.round((n / d) * 100)}%`.padStart(4);
}

async function main(): Promise<void> {
  const orgs = await prisma.organization.findMany({
    select: { id: true, facts: { select: { key: true, state: true } } },
  });
  const optedIn = await prisma.user.count({ where: { digestOptIn: true } });
  console.log(`\n=== грантоЇД.АІ — сигнали продукту (${new Date().toISOString().slice(0, 10)}) ===`);
  console.log(`організацій ${orgs.length} · підписників ${optedIn}\n`);

  // ---- Profiles: who is assessable, who needs a nudge -----------------------
  const answered = (o: (typeof orgs)[number]) =>
    o.facts.filter((f) => f.state !== "UNKNOWN").map((f) => f.key);
  const ready = orgs.filter((o) => coreFactStatus(answered(o)).ready).length;
  const empty = orgs.filter((o) => answered(o).length === 0).length;
  console.log("— ПРОФІЛІ");
  console.log(`  готові до оцінки (≥4 ключових): ${ready}/${orgs.length}`);
  console.log(`  порожні (0 фактів):             ${empty}`);
  console.log(`  мотивувати (між ними):          ${orgs.length - ready - empty}\n`);

  // ---- UI: the questions people skip, weighted by what they unlock ----------
  const impact = await factImpact();
  const skip: { key: string; unknown: number; unlocks: number }[] = [];
  for (const key of FACT_KEYS) {
    const unknown = orgs.filter((o) => !answered(o).includes(key)).length;
    skip.push({ key, unknown, unlocks: impact[key] ?? 0 });
  }
  // Ranked by skipped × unlock: a question that is both widely skipped and worth
  // a lot of calls is the one to reword or move up first.
  skip.sort((a, b) => b.unknown * b.unlocks - a.unknown * a.unlocks);
  console.log("— ПРОПУЩЕНІ ПИТАННЯ (пріоритет для UI: пропуск × розблокування)");
  for (const s of skip.slice(0, 8)) {
    const label = factDefinition(s.key)?.labelUk ?? s.key;
    console.log(
      `  ${label.slice(0, 30).padEnd(30)} пропустили ${pct(s.unknown, orgs.length)} · відкриває ${s.unlocks} конкурсів`,
    );
  }
  console.log("");

  // ---- Prompts: how often the agent was corrected, and on what --------------
  const audit = await prisma.auditEntry.groupBy({
    by: ["action"],
    where: { action: { in: ["fact.confirmed", "fact.corrected"] } },
    _count: true,
  });
  const confirmed = audit.find((a) => a.action === "fact.confirmed")?._count ?? 0;
  const corrected = audit.find((a) => a.action === "fact.corrected")?._count ?? 0;
  const rejected = await prisma.factCandidate.count({ where: { status: "REJECTED" } });
  const accepted = await prisma.factCandidate.count({ where: { status: "ACCEPTED" } });
  console.log("— ВИТЯГУВАННЯ (сигнал для промптів)");
  console.log(`  підтверджено без правок: ${confirmed}`);
  console.log(`  виправлено людиною:      ${corrected}   (${pct(corrected, confirmed + corrected)} від переглянутих)`);
  console.log(`  відхилено (хибні):       ${rejected}   (${pct(rejected, accepted + rejected)} від запропонованих)`);

  // Suspicious rules: non-requirements extracted as rules (the #3 class).
  const noise = [
    /кінцев\w+ терм|терм\w+ подач|за київським час|надсилайте|подати заявк/i,
    /для команди з|отримувач\w+ послуг|учасник\w+ програми/i,
    /критері\w+ оцінюванн|оцінюванн\w+ пропозиц/i,
  ];
  const rules = await prisma.grantEligibilityRule.findMany({
    where: { grant: { status: { not: "CLOSED" } } },
    select: { textUk: true, citations: { select: { quote: true }, take: 1 } },
  });
  const suspicious = rules.filter((r) =>
    noise.some((re) => re.test(`${r.textUk} ${r.citations[0]?.quote ?? ""}`)),
  ).length;
  console.log(`  підозрілі правила (#3):  ${suspicious}/${rules.length}   (не-вимоги, витягнуті як правила)\n`);

  // ---- Product: the recommendation rate and where the feed goes quiet -------
  const matches = await prisma.match.groupBy({ by: ["overall"], _count: true });
  const totalM = matches.reduce((n, m) => n + m._count, 0);
  const recommended = await prisma.match.count({ where: { recommend: true } });
  console.log("— РЕКОМЕНДАЦІЇ (сигнал для продукту)");
  console.log(`  матчів ${totalM} · рекомендовано ${recommended}   (${pct(recommended, totalM)})`);
  for (const m of matches.sort((a, b) => b._count - a._count)) {
    console.log(`    ${m.overall.padEnd(22)} ${pct(m._count, totalM)}  (${m._count})`);
  }
  const orgsWithRec = new Set(
    (await prisma.match.findMany({ where: { recommend: true }, select: { organizationId: true } })).map(
      (m) => m.organizationId,
    ),
  ).size;
  const orgsMatched = (await prisma.match.groupBy({ by: ["organizationId"], _count: true })).length;
  console.log(`  організацій з ≥1 рекомендацією: ${orgsWithRec}/${orgsMatched} проматчених\n`);

  // ---- Delivery -------------------------------------------------------------
  const optOut = await prisma.auditEntry.count({ where: { action: "digest.opted_out" } });
  console.log("— РОЗСИЛКА");
  console.log(`  підписані: ${optedIn} · відписалися колись: ${optOut}\n`);
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
