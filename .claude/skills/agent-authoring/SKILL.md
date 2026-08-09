---
name: agent-authoring
description: The template and contract for adding one of the ten agents — typed input and output schemas, a versioned prompt file, a tool allowlist, a token budget and an eval fixture. Use when adding or modifying any agent, or when tempted to add a capability to an existing prompt instead.
---

# Agent authoring

Ten specialized agents, not one growing prompt: Discovery, Extraction,
Eligibility, Matching, Concept, Application, Review, Compliance, Research,
Organization Knowledge. Adding an eleventh is a copy-the-template operation.

`agents/_template/` is a real directory that gets copied, not a documented
convention. A convention nobody can `cp -r` decays within a month.

## Every agent has five files

```
agents/<name>/
├── input.ts     # Zod schema for what it accepts
├── output.ts    # Zod schema for what it returns
├── prompt.md    # the system prompt, versioned, never an inline string
├── tools.ts     # the allowlist — what this agent may call
└── eval/        # at least one fixture with an expected result
```

No `any` at an agent boundary. The input and output schemas are the contract, and
they are what the orchestrator validates against — an agent that returns
something its own schema rejects has failed, whatever the text says.

## Prompts live in files

`prompt.md`, not a template literal in TypeScript. Three reasons that matter
here: a prompt edit shows up as an isolated diff, the fingerprint recorded with
every eval result is meaningful, and a non-engineer can read and propose changes
to the sentence that decides whether an NGO is told "no" or "we don't know".

Record the prompt fingerprint with every eval run, so a score movement attributes
to the thing that changed.

## Output schemas do two jobs

Split them, as `packages/schemas/match.ts` does:

- The **shape** schema is converted to JSON Schema and constrains decoding. It
  cannot express "this quote is verbatim" or "this verdict is justified".
- The **semantic** schema adds refinements and runs after parsing. This is where
  an assessment that reached past its evidence gets rejected rather than stored.

Constrained decoding guarantees valid JSON. It guarantees nothing about whether
the content is true, and a small local model will produce flawless JSON while
collapsing `UNCERTAIN` into a confident yes.

## Tool allowlist

Declare what the agent may call. The Eligibility agent reads a grant and a
profile and returns a verdict — it has no reason to fetch a URL, and giving it
one widens the blast radius of a prompt injection carried in an uploaded
document. Default to nothing and add deliberately.

## Token budget

Every agent declares one. On a local runtime the budget is a capacity constraint
rather than a bill, but the accounting is the same and it is what tells you when
one organization's re-matching is starving everyone else's.

Set `num_ctx` explicitly on every call — see `model-runtime`. Ollama truncates
from the start of an over-long prompt and reports nothing, and the system prompt
is what disappears first.

## The eval fixture is part of the agent

An agent without a fixture cannot be changed safely, because nothing distinguishes
a prompt improvement from a regression. For the Eligibility and Matching agents,
the fixture is the golden set — see `eval-fixtures`.

## When not to add an agent

If the work is deterministic, it is code. Ranking a feed by deadline proximity,
computing profile completeness, rolling criterion verdicts up to an overall
verdict — none of these need a model, and putting them behind one makes them
slower, more expensive and non-reproducible. `packages/schemas/ladder.ts` is pure
functions for exactly this reason.

Reach for an agent when the input is natural language whose shape you cannot
predict. Everything else is a function.
