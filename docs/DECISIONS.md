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
