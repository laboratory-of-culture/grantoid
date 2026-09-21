/**
 * How much each profile fact is worth — in grants, not in the abstract.
 *
 * A profile screen that shows "18 questions, 3 answered" tells someone they are
 * behind but not what to do about it, and the live data says most of the 18 do
 * not move the needle for any current call. This counts, per fact, the open
 * grants whose eligibility rules resolve against it: answering that fact is what
 * lets those grants be judged instead of left UNCERTAIN. The screen can then say
 * "answer this to unlock nine calls" — a reason, not a chore.
 *
 * Closed calls are excluded: unlocking a grant nobody can still apply to is not
 * an unlock. Counted by distinct grant, because one call often states the same
 * requirement in several rules and a fact should be worth the call once.
 */

import { prisma } from "./tenancy";

export async function factImpact(): Promise<Record<string, number>> {
  const rules = await prisma.grantEligibilityRule.findMany({
    where: { resolvingFactKey: { not: null }, grant: { status: { not: "CLOSED" } } },
    select: { resolvingFactKey: true, grantId: true },
  });

  const grantsByFact = new Map<string, Set<string>>();
  for (const r of rules) {
    if (!r.resolvingFactKey) continue;
    let set = grantsByFact.get(r.resolvingFactKey);
    if (!set) {
      set = new Set();
      grantsByFact.set(r.resolvingFactKey, set);
    }
    set.add(r.grantId);
  }

  return Object.fromEntries([...grantsByFact].map(([key, grants]) => [key, grants.size]));
}
