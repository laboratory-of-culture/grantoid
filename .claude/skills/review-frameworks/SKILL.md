---
name: review-frameworks
description: SMART, the logic chain, and the eight readiness dimensions with their weights — plus the framing rule that this is a quality assessment and never a prediction of funding. Use when building the AI reviewer, the readiness score, the application workspace, or any copy that reports them.
---

# Review frameworks

Three checks the reviewer runs, and one framing rule that outranks all of them.

## The framing rule

The readiness score is an **AI quality assessment**, never a prediction that a
donor will fund the project. Say so in the interface, next to the number, every
time.

This is not legal caution. An NGO that reads 82/100 as "82% chance of funding"
makes a resourcing decision on a number that means nothing of the kind, and the
one thing this product must never do is manufacture false confidence. The same
rule governs the match score (`explainable-output`); the reviewer is where the
temptation is strongest, because a readiness number *feels* predictive.

Never: «Ваші шанси — 82%», «Ця заявка, ймовірно, отримає фінансування».
Instead: «Оцінка якості заявки — 82 зі 100. Це оцінка тексту, а не прогноз
рішення донора.»

## SMART

Applied to objectives, not to the whole application.

| Letter | Checks | Typical failure |
|---|---|---|
| Specific | one outcome, named audience | «покращити ситуацію в громаді» |
| Measurable | a number, or a countable output | no indicator at all |
| Achievable | proportionate to team, budget, timeline | 12 000 participants on a €10k budget |
| Relevant | serves the stated problem and the donor's priorities | objective unrelated to the problem section |
| Time-bound | within the project period | «у майбутньому» |

Report per objective, per letter, with the sentence at fault quoted. A verdict on
"the objectives" as a block is not actionable.

## The logic chain

```
Проблема → Мета → Завдання → Заходи → Продукти → Результати → Вплив
Problem  → Goal → Objectives → Activities → Outputs → Outcomes → Impact
```

Check each link, in both directions:

- **Forward:** does each activity produce a stated output? Does each output
  plausibly contribute to an outcome?
- **Backward:** is every outcome reachable from something in the plan? An outcome
  with no activity behind it is the most common break, and the one reviewers
  catch.

Report a break as the two links it sits between, quoted — «Завдання 2 не має
жодного заходу» — not as a score on "logic".

## The eight readiness dimensions

Weights are fixed. Changing them changes every historical score, so treat a
weight change as a versioned decision recorded in `docs/DECISIONS.md`, and stamp
each stored score with the weight-set version.

| Dimension | Weight |
|---|---|
| Eligibility | 20 |
| Completeness | 15 |
| Donor alignment | 15 |
| Methodology | 12 |
| SMART objectives | 12 |
| Impact | 10 |
| Budget logic | 8 |
| Clarity | 8 |

Eligibility carries the most weight because it is the only dimension where a
failure makes every other dimension irrelevant.

The composite never renders without its eight components — same rule as the match
score. A single number invites the trust the framing rule exists to withhold.

## The reviewer cites

Every finding quotes the passage it is about and names the framework it comes
from. A comment that cannot point at a sentence is an opinion, and the user has
no way to act on it or disagree with it.

Findings are suggestions on the user's document. The reviewer never edits the
text — see `human-in-the-loop`.

## Donor alignment reads the actual call

Alignment is checked against the extracted `evaluationCriteria` and the call's
own priority language, not against a general notion of good practice. Quote the
donor's phrasing in the finding: «Донор наголошує на регіональному впливі
(«relevance to the needs of Ukrainian society»), але заявка не описує його».

Where the call was only partially extracted (`extractionConfidence` below 1), say
so on the alignment findings. An alignment check against half a call is worth
less than one against a whole call, and the user should know which they have.
