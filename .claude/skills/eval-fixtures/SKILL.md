---
name: eval-fixtures
description: The golden set that regression-tests matching, the metrics it reports, and the rule that no model or prompt change ships without a run. Use when adding fixtures, writing gold labels, changing a prompt or model, or interpreting an eval result.
---

# Eval fixtures

The golden set is what turns "the verdicts look reasonable" into a number. On a
local runtime (`docs/DECISIONS.md` D1) it is also the only thing standing between
a plausible-sounding small model and a Ukrainian NGO wasting three weeks.

Lives in `evals/fixtures/`: `grants/`, `orgs/`, `labels.yaml`. Loaded and
validated by `evals/load.ts`; `npm run fixtures:check` runs in CI.

## The metrics, and which one actually matters

| Metric | Definition | Reading |
|---|---|---|
| **False-eligible rate** | gold negative, predicted positive | The one that ships harm. Treat any rise as a release blocker. |
| **Unknown-collapse rate** | gold `UNCERTAIN`, predicted definite | The characteristic small-model failure. Rises quietly; valid JSON throughout. |
| **Evidence-citation rate** | `grantQuote` appears verbatim in the source | Catches fluent quotations the donor never wrote. |
| Feed precision | relevant ÷ recommended | The §40 headline. Improves for bad reasons if the other three are unwatched. |
| Criterion agreement | exact, and within one rung | Where a shallow reading shows up that the overall verdict hides. |

Report all five. A run that reports feed precision alone is not an eval — a model
that answers "eligible" more often can move it in the right direction while
getting more organizations rejected wrongly.

## Writing a gold label

Every pair carries a `note` explaining the call. Read it before disputing a
score: several labels are deliberately close, and the adjacent-agreement metric
separates "one rung off" from an outright miss.

The set currently holds four grants — two real House of Europe calls, two
synthetic — and two organization profiles, fully crossed at eight pairs.

Three coverage properties the checker enforces, because each one is a way the set
quietly stops testing anything:

- At least one pair labelled `UNCERTAIN`, or the set cannot detect a model that
  collapses unknowns.
- At least one pair labelled `NOT_ELIGIBLE`, or hard blockers go untested.
- At least one profile with an `UNKNOWN` fact and one with an
  `EXPLICIT_NEGATIVE`, or neither side of the D4 rule is reachable.

## The canonical trio

Keep it. Three profiles against the same rule —
`hoe-translation:applicant-is-publisher` — landing on three different rungs:
`EXPLICIT_NEGATIVE` → `NOT_ELIGIBLE`, silent-but-implausible →
`LIKELY_NOT_ELIGIBLE`, never-asked → `UNCERTAIN`. A model that cannot separate
those three has not understood the product, whatever its aggregate score.

## Fixtures are sparse

Organization fixtures list only answered facts; `evals/load.ts` expands the rest
to `UNKNOWN` against `FACT_REGISTRY`. Adding a registry key must not require
editing every fixture — if it did, the registry would stop growing.

## When to run

- Any prompt edit. Record `prompts.promptFingerprint()` with the result.
- Any model, quantization or `num_ctx` change. Record all three.
- Any change to the ladder, the roll-up, or `shouldRecommend`.
- Before merging anything that touches a verdict.

Compare like with like: a score from a different model tag or prompt fingerprint
is not a baseline, it is a different experiment.

## Growing the set

Target from the brief's §52: roughly 20 real grants across 5 real organization
profiles. Prefer real calls over synthetic ones — real calls have the gaps that
make the UNCERTAIN path matter, and synthetic ones tend to be accidentally
complete. When a real user reports a wrong verdict, that pair becomes a fixture
before the fix is written.
