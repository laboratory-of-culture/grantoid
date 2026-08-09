# Milestone 1 proposal — data model and `grant-schema`

Awaiting sign-off. No feature code, no migration, no scaffold until (a), (b) and
(c) below are agreed and the two blocking questions are answered.

Companion file: `docs/proposals/schema.prisma`.

---

## Open questions

Two block scaffolding. Three do not, but change the shape of the work.

### 1. Anthropic API or local Ollama? — **blocking**

The kickoff prompt says "Anthropic API for all agents; structured outputs
enforced with Zod schemas." Earlier today the instruction was "for start let use
local ollama", and an Ollama runtime seam is already written in
`spike/matching/llm.py`.

These need reconciling before anything is scaffolded, because they are not
interchangeable at this scale of hardware. The machine here is an RTX 3050 with
4 GB of VRAM and 16 GB of system RAM. Models that fit comfortably are in the
3–4B class; `llama3:latest` and `mistral-openorca` (the two currently pulled) are
7–8B, will partially spill to CPU, and both predate the multilingual generation
that handles Ukrainian well.

That matters more than throughput. The one behaviour this product cannot get
wrong — holding `UNCERTAIN` rather than collapsing it into a confident yes or no
— is the first thing small models lose, and constrained decoding will not save
you, because the JSON stays perfectly valid while the judgment inside it goes
wrong.

**Recommendation: both, split by task.** Ollama for extraction and
normalization — high volume, long inputs, mechanical output, no reason to pay per
token. Anthropic for the eligibility and matching agents, which are low-volume and
are the ones where being wrong costs a user weeks. The `model-runtime` skill
already frames the seam this way. If the answer is Ollama-only, that is a
workable development posture, but the eval harness has to gate it and I would
expect the first honest reading to be poor.

### 2. Five verdict states or six? — **blocking**

The prompt says: five states, "plus `UNKNOWN` when the profile lacks the data."
That reads as six, and `UNCERTAIN` versus `UNKNOWN` is not self-evident — two
overlapping states invite inconsistent labelling across agents and fixtures.

**Recommendation: five verdicts, plus an `UncertaintyReason` discriminator on
`UNCERTAIN`** — `NO_PROFILE_DATA`, `AMBIGUOUS_CALL`, `CONFLICTING_EVIDENCE`. This
keeps the ladder orderable (the overall verdict is a floor, which needs a total
order) and still produces your four UI buckets exactly: the *unknown* bucket is
`UNCERTAIN` + `NO_PROFILE_DATA`, and it is the only bucket whose rows carry a
"complete your profile" action. `AMBIGUOUS_CALL` belongs in *potential problem*,
because the fix is reading the guidelines, not editing the profile.

Modelled that way in the proposed schema. Say the word and I will flatten it to a
sixth enum member instead.

### 3. TypeScript everywhere, or the brief's Python backend?

Brief §26 proposes Python/FastAPI for the backend with Next.js on the front. The
kickoff prompt proposes Next.js + Prisma + Vitest for everything.

**Recommendation: all TypeScript, as the prompt says.** One language, one schema
package feeding both Prisma and the agent boundaries, no serialization seam
between the matcher and the UI. The brief's stack section is explicitly
"potential", and for a small team the single-language win is worth more than
Python's ML ergonomics here — nothing in this product trains anything.

Consequence: the Python spike written earlier today is throwaway *code*. What
survives and ports is the content — the two real House of Europe grant fixtures,
the two org profiles, and the gold labels — which are YAML and language-neutral.

### 4. Skill names

Three skills already exist in `.claude/skills/`, written before the kickoff
prompt landed, under names that do not match your table:

| Existing | Your table |
|---|---|
| `eligibility-contract` | split into `eligibility-engine` + `explainable-output` |
| `grant-schema` | `grant-schema` — keeps the name |
| `model-runtime` | not in your table; needed while a local runtime is in play |

Your table wins. I will split and rename to match, and keep `model-runtime` as an
eleventh unless you want the provider decision folded into `agent-authoring`.

### 5. Archivo must be self-hosted

Not a real obstacle, just easy to get wrong later: ship Archivo as a local
`@font-face` under `packages/ui`, not a Google Fonts link. A CDN link breaks
under the Artifact CSP if any screen is ever published as a prototype, and it
silently falls back to a system face rather than failing loudly. Same rule for
Lucide — import the React components, never a CDN `<script>`.

---

## (a) Repo structure

```
grant-assistant/
├── app/                            # Next.js App Router — Ukrainian-first routes
│   ├── (app)/profil/               # org profile + onboarding
│   ├── (app)/mozhlyvosti/          # personalized feed
│   ├── (app)/hranty/[id]/          # grant detail + match breakdown
│   ├── (app)/kontseptsii/[id]/     # concept generator
│   ├── (app)/zayavky/[id]/         # application workspace + reviewer
│   ├── (app)/vymohy/[id]/          # requirement checklist
│   ├── (admin)/dzherela/           # source registry
│   └── api/
├── agents/
│   ├── _template/                  # input.ts · output.ts · prompt.md · tools.ts · eval/
│   ├── discovery/  extraction/  eligibility/  matching/  concept/
│   ├── application/  review/  compliance/  research/  knowledge/
│   └── orchestrator/               # routing, budgets, tracing
├── packages/
│   ├── schemas/                    # Zod — the single source of truth
│   │   ├── grant.ts  organization.ts  verdict.ts  fact-registry.ts
│   ├── prompts/                    # versioned .md, never inline strings
│   ├── evaluation/                 # harness + metrics
│   ├── llm/                        # provider seam (Anthropic / Ollama)
│   └── ui/                         # Modernist tokens + component vocabulary
├── prisma/schema.prisma
├── workers/                        # BullMQ: crawl · extract · rematch · recheck
├── evals/fixtures/                 # grants/ · orgs/ · labels.yaml
├── docs/
└── .claude/skills/
```

Two notes on the shape. `packages/schemas` is upstream of both Prisma and the
agents so a field cannot exist in one and not the other — the drift
`grant-schema` exists to prevent. And `agents/_template/` is a real directory
that gets copied, not a documented convention, because a convention nobody can
`cp -r` is a convention that decays.

## (b) Prisma schema

In `docs/proposals/schema.prisma`. The decision worth reviewing before the rest:

`OrganizationFact` gives every profile field an explicit `FactState` —
`UNKNOWN` / `SELF_REPORTED` / `CONFIRMED` / `EXPLICIT_NEGATIVE` — with a row
created for every key in the registry at organization creation, defaulting to
`UNKNOWN`.

A nullable column cannot distinguish "this NGO has no international partners"
from "nobody has asked this NGO about international partners". Those two produce
opposite verdicts on the same real House of Europe call, so the distinction has
to live in the database rather than in a convention the next agent may not
follow. `EXPLICIT_NEGATIVE` is what earns a `NOT_ELIGIBLE`; `UNKNOWN` can only
ever earn `UNCERTAIN`.

The rest follows: `Citation` with a required verbatim `quote` hanging off every
asserted fact, `GrantSnapshot` for §29 change detection, and a `Match`
uniqueness key over prompt fingerprint plus both content hashes so a cached
verdict can never outlive the inputs that produced it.

## (c) Milestone 1 task list

Ordered. Nothing here is feature code in the product sense — it is the floor
everything else validates against.

| # | Task | Done when |
|---|---|---|
| 1 | Settle blocking questions 1 and 2 | Answers recorded in `docs/DECISIONS.md` |
| 2 | Scaffold Next.js + TS + Prisma; `docker-compose` for Postgres with `pgvector` | `pnpm dev` serves, `prisma migrate dev` runs clean |
| 3 | `packages/schemas`: Zod for Grant, EligibilityRule, Citation, OrganizationProfile, Verdict | Types import in both a worker and a route with no `any` at the boundary |
| 4 | Fact-key registry — the fixed list of profile keys, with Ukrainian labels | Registry is data, not a union type scattered across files |
| 5 | `prisma/schema.prisma` + first migration + the `profileQuote`/`UNCERTAIN` check constraint | Migration applies; constraint rejects a bad row in a test |
| 6 | **Ladder tests before the ladder** — `rollUp()` floor semantics, and UNKNOWN→UNCERTAIN never NOT_ELIGIBLE | Tests exist and fail; then pass against the implementation |
| 7 | Port fixtures: 2 real House of Europe grants, 2 synthetic, 2 org profiles, gold labels | `evals/fixtures/` loads and validates against the Zod schemas |
| 8 | `.claude/skills/` — your ten plus `eval-fixtures` | Each has a trigger description and a concrete example from the fixtures |
| 9 | `packages/ui` Modernist tokens — Archivo self-hosted, zero radius, 2px rules, `2px` accent focus ring | A token audit script finds no hard-coded hex or px in components |
| 10 | CI: vitest, `prisma validate`, fixture load, ladder tests | Green on a PR |

Explicitly **not** in milestone 1: any crawler, any agent implementation, any
screen. Stage 2 does not start until stage 1 is solid — your instruction, and
the right one.

### What already exists in this repo

- `Grant Assistant for Ukrainian NGOs.md` — the brief, read in full.
- `spike/matching/` — Python spike: schemas, prompts, Ollama seam, matcher, plus
  the fixtures listed in task 7. Code is throwaway under recommendation 3; the
  YAML fixtures port.
- `.claude/skills/` — three skills, to be renamed per question 4.
- Nothing committed yet. First commit lands after sign-off.
