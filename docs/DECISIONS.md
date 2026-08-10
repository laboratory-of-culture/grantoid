# Decisions

Architectural decisions and the reasoning behind them. Append; do not rewrite
history. When a decision is reversed, add a new entry that supersedes the old one
rather than editing it.

---

## D1 — Local Ollama is the model runtime for every agent

**Date:** 2026-08-10 · **Status:** accepted · **Supersedes:** the kickoff prompt's
"Anthropic API for all agents"

All ten agents run against local Ollama at `http://localhost:11434`. No hosted
model API is called.

**Why.** NGO statutes, previous applications and financial information are the
product's most sensitive inputs (brief §44), and keeping them on infrastructure
we control removes a whole class of data-processing questions before they are
asked. It also removes per-token cost, which §38 names as the main financial
risk, and converts it into a capacity and latency problem instead.

**What this costs us, stated plainly.** The current development machine is an
RTX 3050 with 4 GB VRAM and 16 GB RAM. That places us in the 3–4B class for
models that fit comfortably. The behaviour this product depends on most —
holding `UNCERTAIN` instead of collapsing it into a confident yes or no — is the
first thing small models lose, and schema-constrained decoding does not help,
because the JSON stays valid while the judgment inside it goes wrong.

**Consequences.**

- `packages/llm` is the only module that imports the Ollama client. Provider
  choice is a config concern per agent, so D1 is reversible for a single agent
  without touching call sites.
- `num_ctx` is set explicitly on every call. Ollama truncates from the *start* of
  an over-long prompt and reports nothing, which silently removes the system
  prompt — the exact instructions that carry the UNCERTAIN rule.
- Eval gates trust. No agent's output is used in the product until
  `eval-fixtures` reports its false-eligible rate and unknown-collapse rate.
  A poor first reading is expected and is information, not failure.
- `qwen3:4b` is the working default. `llama3:latest` and `mistral-openorca`
  predate the multilingual generation and are not suitable for Ukrainian
  eligibility reasoning.
- Revisit if the eval gate cannot be passed at any locally-runnable size. The
  natural fallback is a hosted model for the eligibility and matching agents
  only, which is where volume is lowest and the cost of being wrong is highest.

---

## D2 — Five verdict states, plus an uncertainty reason code

**Date:** 2026-08-10 · **Status:** accepted · **Clarifies:** the kickoff prompt's
"five states … plus `UNKNOWN`"

The ladder has exactly five rungs: `MATCH`, `LIKELY_MATCH`, `UNCERTAIN`,
`LIKELY_NOT_ELIGIBLE`, `NOT_ELIGIBLE`. An `UNCERTAIN` assessment additionally
carries an `UncertaintyReason`: `NO_PROFILE_DATA`, `AMBIGUOUS_CALL`, or
`CONFLICTING_EVIDENCE`.

**Why not a sixth rung.** The overall verdict is defined as the *floor* of the
mandatory criteria, which requires a total order over the states. `UNKNOWN` has
no natural position in that order relative to `UNCERTAIN` — the two overlap in
meaning, which invites inconsistent labelling across agents and gold fixtures and
makes the roll-up ambiguous.

**How the four UI buckets fall out.**

| Bucket | Condition | Action offered |
|---|---|---|
| Matched | `MATCH`, `LIKELY_MATCH` | none |
| Potential problem | `LIKELY_NOT_ELIGIBLE`, or `UNCERTAIN` + `AMBIGUOUS_CALL` / `CONFLICTING_EVIDENCE` | read the guidelines; resolve the conflict |
| Not matched | `NOT_ELIGIBLE` | none — this is a blocker |
| Unknown | `UNCERTAIN` + `NO_PROFILE_DATA` | complete the named profile field |

Only the unknown bucket carries a "complete your profile" action, and it is
driven by `resolvingFactKey` on the assessment.

---

## D3 — TypeScript everywhere

**Date:** 2026-08-10 · **Status:** accepted · **Supersedes:** brief §26's
Python/FastAPI backend

Next.js (App Router) + TypeScript + Prisma + Postgres/pgvector. Vitest and
Playwright. No Python service.

**Why.** One language, and one Zod schema package feeding both Prisma and every
agent boundary, so a field cannot exist on one side and not the other. That is
the drift the `grant-schema` skill exists to prevent, and a cross-language seam
reintroduces it at exactly the boundary the kickoff prompt says must have no
`any`. The brief's stack section is explicitly framed as "potential", and nothing
in this product trains a model, so Python's ML ecosystem buys us little.

**Consequence.** The Python spike under `spike/matching/` is superseded as code.
What ports forward is content, not implementation:

- `spike/matching/data/grants/` — two real House of Europe calls, two synthetic
- `spike/matching/data/orgs/` — two org profiles exercising unknown vs explicit-negative
- the gold labels, once written

The `.py` files stay in the tree until the fixtures are ported into
`evals/fixtures/` under the Zod schemas, then they go.

---

## D7 — The extraction agent does not reason

**Date:** 2026-08-10 · **Status:** accepted · **Contrast with:** D6

`think: false` for the Organization Knowledge agent, opposite to the eligibility
agent.

**Why.** Measured on the same synthetic statute, one variable changed:

| | think on | think off |
|---|---|---|
| latency | 258.6s | **21.7s** |
| facts proposed | 6 | 5 |
| `non_profit_status` extracted | **no** | **yes** |
| inferred-not-stated facts | 2 | **0** |

Faster *and* better, which was not the expected trade. Reasoning made the model
infer: it derived `geographic_coverage` and `target_audiences` from a sentence
about the organization's *mission*, which the prompt explicitly forbids — and it
missed the most literal fact in the document, one the statute states twice and
which gates eligibility on two of the four fixture grants.

The tasks are not alike. Eligibility is a judgement, and reasoning bought a
measurable 80% → 88% there. Extraction is mechanical — find the sentence, copy
it — and thinking gives the model room to editorialise where it should be
transcribing. `model-runtime` classifies extraction as high-volume,
low-judgement work; this is what that means in practice.

**Caveat: one document.** The direction is clear and the latency difference is
not marginal, but this is n=1. Re-measure on real statutes once the end-to-end
loop exists, which is the point at which quality problems become visible where
they actually matter.

**Two bugs the smoke test found, both invisible to unit tests:**

- Accepting a candidate wrote `candidate.state` straight through, so a positive
  fact stayed `SELF_REPORTED` forever and never became usable in an application.
  The gate looked closed — citation, timestamp and audit entry all present —
  while the thing it guards was unreachable. The smoke's own assertion had
  encoded the bug by comparing against the candidate's state.
- Deleting a document cascades its citations away, stranding any `CONFIRMED`
  fact whose last citation it was. The database enforces "confirmed implies
  cited" on write and cannot enforce it through a cascade. Deletion now demotes
  those facts to `SELF_REPORTED` and logs `fact.provenance_lost` — the
  organization asked for the document to go, and D1's promise means it actually
  goes.

---

## D6 — The eligibility agent reasons before answering

**Date:** 2026-08-10 · **Status:** accepted · **Builds on:** D5

`think: true` is the default for the eligibility agent, and only that agent.

**Why.** Measured on the golden set, same model, prompt, seed and constraints:

| | prompt only | + constraints | + constraints & think |
|---|---|---|---|
| **unknown-collapse** | 100% | 50% | **0%** |
| criterion exact | 70% | 80% | **88%** |
| criterion within one rung | 85% | 85% | **96%** |
| overall verdict exact | 63% | 75% | 75% |
| false-eligible | 0% | 0% | 0% |
| median latency | 25s | 25s | **82s** |

Thinking is what closes the gap the constraints cannot reach. The constraints
enforce the rule where a single fact resolves it; thinking is what stops the
model misreading a fact it *does* have — the Zhytomyr-fails-a-Ukraine-rule error
from D5 does not recur.

**The cost is affordable here and would not be everywhere.** 82 seconds a pair is
fine for matching, which is queue work against a feed that regenerates when a
grant or a profile changes. It would not be fine for anything a person waits on,
which is why this is set per agent rather than in the runtime seam.

**What the remaining misses are.** Two pairs, both one rung, both toward
*caution*: where the label says `LIKELY_NOT_ELIGIBLE` the model says
`UNCERTAIN`. That is the safe direction of error for this product — it surfaces a
question rather than a rejection — and both labels are ones the fixture notes
already flag as close calls.

**Open.** Feed recall sits at 67%: one pair the labels say should reach the feed
does not, because `matchScore` fell under `RECOMMEND_SCORE_FLOOR`. The floor was
a starting value, and this is the eval telling us to tune it. Do not move it
without re-running both directions — lowering it trades recall for precision, and
precision is the metric §40 says the product is judged on.

---

## D5 — The unknown rule is enforced in code, not asked for in the prompt

**Date:** 2026-08-10 · **Status:** accepted · **Refines:** D1, D2

After generation, every criterion whose rule names a `resolvingFactKey` is
checked against that fact's stored state and corrected where the model reached
past its evidence: an unanswered fact forces `UNCERTAIN`, and only
`EXPLICIT_NEGATIVE` lets a `NOT_ELIGIBLE` stand. The overall verdict is then
recomputed from the corrected criteria. Corrections are recorded, not applied
silently.

**Why.** The first eval run against `qwen3:4b` collapsed **every** `UNCERTAIN`
pair — once into `MATCH`, once into `NOT_ELIGIBLE`, on the same empty profile
field. The rule was stated clearly in the prompt. A 4B model does not reliably
follow it.

It does not have to. Which fact resolves which rule is recorded data, and the
fact's state is known exactly, so the product's central claim never needed to
depend on a model obeying an instruction. `permittedVerdicts` already existed in
`packages/schemas/ladder.ts`; it simply was not wired into the agent.

**Baseline, same model, same prompt, same seed:**

| Metric | Prompt only | With constraints |
|---|---|---|
| unknown-collapse | 100% | 50% |
| overall verdict exact | 63% | 75% |
| criterion exact | 70% | 80% |
| false-eligible | 0% | 0% |
| verbatim citations | 100% | 100% |

`qwen3:4b`, `num_ctx` 16384, seed 7, think off, prompt `9daf7a1ccd20`, 8 pairs,
median 25s per pair.

**What the constraint cannot fix.** The residual misses are judgement errors on
facts the profile *does* state — the model read a Zhytomyr organization as
failing a "Ukraine, EU or UK" geography rule. No amount of post-hoc constraint
repairs a wrong reading of a known fact; that is model capability, and it is the
honest measure of what 4B buys us.

**Consequences.**

- The correction count is a model-quality signal. A model that needs correcting
  often is one to replace, and that is only visible because the count is
  recorded rather than the fix being silent.
- Next experiments, in order: `--think` on qwen3, then a larger model, then
  prompt work. Prompt work is last because the enforceable half is now enforced.
- The remaining `unknown-collapse` at 50% is a single pair whose miss comes from
  the geography error above, not from an uncorrected unknown.

---

## D4 — Absence of data is a stored state, not a NULL

**Date:** 2026-08-10 · **Status:** accepted

Every organization profile field has an `OrganizationFact` row from the moment
the organization is created, carrying a `FactState` of `UNKNOWN`,
`SELF_REPORTED`, `CONFIRMED` or `EXPLICIT_NEGATIVE`.

**Why.** A nullable column cannot distinguish "this NGO has no international
partners" from "nobody has asked this NGO about international partners". On the
real House of Europe International Cooperation call those two produce opposite
verdicts — `LIKELY_NOT_ELIGIBLE` versus `UNCERTAIN` — and the second one is a
grant the organization can still win by answering one question.

The product's central claim is that it tells those apart. A claim that depends on
every future agent remembering a convention is a claim that fails. It belongs in
the schema, where `EXPLICIT_NEGATIVE` is the only state that can justify
`NOT_ELIGIBLE`, and `UNKNOWN` can only ever produce `UNCERTAIN`.
