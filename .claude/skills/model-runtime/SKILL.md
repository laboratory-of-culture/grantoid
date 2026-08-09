---
name: model-runtime
description: How the product talks to a language model. Local Ollama is the runtime for every agent (DECISIONS.md D1). Use when adding or changing any model call, setting context length, adding structured output, choosing or swapping a model, or reading an eval result.
---

# Model runtime

Local Ollama at `http://localhost:11434`, every agent, no hosted model API.
`packages/llm` is the only module that imports the Ollama client.

The reasoning and the cost of this decision are in `docs/DECISIONS.md` D1. The
short version: NGO documents stay on infrastructure we control, and we accept a
real capability ceiling in exchange.

## One seam

Agents depend on the task interface, not on Ollama: a system prompt, a user
message, a Zod schema, and a returned object plus usage. Client construction,
constrained decoding, retries and token accounting live behind it.

D1 is reversible per agent without touching call sites. If the eligibility agent
cannot pass its eval gate at any locally-runnable size, that agent's provider
changes in config — which is the whole point of keeping the seam.

## Structured output

Ollama takes a JSON Schema in `format` and constrains decoding to it. Derive the
schema from the agent's Zod output type so there is one definition, not two:

```ts
import { zodToJsonSchema } from "zod-to-json-schema";

const res = await ollama.chat({
  model: MODEL,
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ],
  format: zodToJsonSchema(MatchResult),
  options: { num_ctx: 16384, temperature: 0, seed: 7 },
});

const parsed = MatchResult.parse(JSON.parse(res.message.content));
```

Parse with Zod afterwards regardless. Constrained decoding guarantees the shape —
not that the enum value is the one you wanted, not that a required prose field is
non-empty, and not that the verdict is defensible.

## Set `num_ctx` on every call

Ollama's default context window is a few thousand tokens, well under what a grant
plus an org profile plus a schema needs. When the prompt exceeds it, Ollama
**truncates from the start and reports nothing** — and the system prompt is what
goes first. The symptom is an agent that appears to ignore the UNCERTAIN rule;
the cause is that it never saw it.

Set it explicitly, size it against real fixtures, and check the reported prompt
token count against the window after every call. A prompt that filled the window
is a hard failure, not a degraded answer to be used anyway.

## Determinism

`temperature: 0` and a fixed `seed` for evals and for anything whose output is
cached against a content hash. A verdict that moves between identical runs cannot
be attributed to any change, and `Match`'s uniqueness key assumes it does not.

## Structured output is not the hard part

The shape will be valid. The judgment inside it is the risk.

`eligibility-engine` asks the model to distinguish "the profile contradicts this"
from "the profile does not say". The characteristic failure of a small local
model is collapsing `UNCERTAIN` into a confident yes or no while emitting
flawless JSON. Expect it on 4 GB of VRAM, and let the eval say how bad rather
than reading a few outputs and forming an impression.

## Choosing a model

Two capabilities matter more than benchmark averages:

- **Ukrainian.** Extraction and generation both run on Ukrainian text, and
  quality there varies far more than English scores predict. Test on the real
  fixtures, never on translations.
- **Adherence to a negative constraint.** "Unknown is not no" is the single
  behaviour the product depends on, and it deserves its own probe set.

`qwen3:4b` is the working default — it fits a 4 GB card with room for a real
context window and handles Ukrainian materially better than the Llama 3 8B
generation. `llama3:latest` and `mistral-openorca` are not suitable for
eligibility reasoning here.

Prefer larger-and-quantized over smaller-and-full-precision. Record the
quantization tag: `:q4_K_M` and `:q8_0` of the same model are different models
for this purpose.

## Before switching or upgrading a model

Run `eval-fixtures` on the current model, switch, run again. The gate is the
false-eligible rate and the unknown-collapse rate — not feed precision alone, and
not how good the summaries read.

Record model tag, quantization, `num_ctx`, seed and prompt fingerprint with every
run so a score movement attributes to the thing that changed.

## Cost did not disappear

Self-hosting converted §38's uncontrolled-spend risk into a capacity and latency
risk. Record tokens and wall-clock per call anyway: it is what tells you when one
organization's re-matching is starving everyone else's, and it is the number
you will need if D1 is ever revisited.
