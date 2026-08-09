---
name: eligibility-engine
description: The five-state confidence ladder, the rule that missing profile data yields UNCERTAIN rather than a rejection, and how criterion verdicts roll up to an overall verdict. Use when writing or reviewing the eligibility agent, the matching agent, the roll-up logic, verdict storage, or any test of them.
---

# Eligibility engine

The ladder is the product. Get it wrong in the permissive direction and an NGO
spends three weeks on an application it was never eligible for; get it wrong in
the restrictive direction and it never sees a grant it would have won.

Pair with `explainable-output`, which governs what has to ship *alongside* every
verdict. This skill governs the verdict itself.

## The five rungs

| State | Use when |
|---|---|
| `MATCH` | The profile establishes the requirement is met. |
| `LIKELY_MATCH` | The profile strongly implies it without stating it. |
| `UNCERTAIN` | The profile does not settle the question either way. |
| `LIKELY_NOT_ELIGIBLE` | The profile strongly implies the requirement is not met. |
| `NOT_ELIGIBLE` | The profile establishes the requirement is not met. |

Five rungs, not six. `UNCERTAIN` carries an `UncertaintyReason` —
`NO_PROFILE_DATA`, `AMBIGUOUS_CALL`, `CONFLICTING_EVIDENCE` — which is what the
UI buckets on. See `docs/DECISIONS.md` D2.

## Unknown is not no

A requirement the profile does not address is `UNCERTAIN` with reason
`NO_PROFILE_DATA`. `NOT_ELIGIBLE` requires a positive contradiction.

The schema enforces where that contradiction can come from: only a fact in state
`EXPLICIT_NEGATIVE` justifies `NOT_ELIGIBLE`. A fact in state `UNKNOWN` can only
ever produce `UNCERTAIN`. This is `docs/DECISIONS.md` D4, and it is why absence
is a stored `FactState` rather than a NULL — an agent must not be able to infer
"they don't have one" from "the row is empty".

Silence is not a yes either. Do not resolve a criterion because it would be
plausible for an organization of this kind to satisfy it.

**The canonical trio.** Same rule — House of Europe Translation Grants,
"the applicant must be a publisher-translator duo" — three profiles:

- Fact `is_publisher` in state `EXPLICIT_NEGATIVE` → `NOT_ELIGIBLE`.
- Fact in state `UNKNOWN`, profile describes a culture NGO running exhibitions →
  `LIKELY_NOT_ELIGIBLE`. Strong inference; an NGO can co-publish.
- Fact in state `UNKNOWN`, nothing in the profile bears on publishing at all →
  `UNCERTAIN` / `NO_PROFILE_DATA`.

The same shape governs `hoe-international-cooperation:international-partner`. An
organization that has never been asked about partners is `UNCERTAIN`, and that
grant still reaches its feed with one question attached. Rendering an unasked
question as a near-rejection is the failure that loses a user a grant.

## Roll-up is a floor, not an average

`Match.overall` is the worst verdict among the **mandatory** criteria. One
`NOT_ELIGIBLE` mandatory criterion makes the whole match `NOT_ELIGIBLE` however
well everything else fits. Rules with `kind: PREFERRED` move the score and never
the overall verdict; `EXCLUDED` rules are evaluated as mandatory.

Do not average, weight, or round the ladder into the overall verdict. The ladder
is ordinal, not numeric.

## Score and verdict are separate axes

`matchScore` (0–100) measures fit on the merits — sector, scale, target group,
experience — ignoring hard blockers. A perfect-fit organization ruled out on
legal form still scores high and is still `NOT_ELIGIBLE`. Never derive one from
the other.

## Recommend is a precision decision

`recommend` decides whether the grant reaches the feed. Recommend one with open
questions when the fit is otherwise good — an open question is something the
organization can answer in an afternoon. Do not recommend one with an established
blocker.

The feed optimizes precision: five grants of which four are worth reading beats
fifty. A change that raises recommendations without raising the relevant share
made the product worse.

## Tests come first

Per the kickoff instruction, the ladder's tests are written before the ladder.
The three that must exist before any implementation:

1. `rollUp()` returns the floor of mandatory criteria, ignoring `PREFERRED`.
2. A criterion whose resolving fact is `UNKNOWN` never yields `NOT_ELIGIBLE` or
   `LIKELY_NOT_ELIGIBLE` from the engine's own logic.
3. `EXPLICIT_NEGATIVE` on the resolving fact is the only input that permits
   `NOT_ELIGIBLE`.

## Before merging anything that touches a verdict

- States come from the shared enum, never string literals.
- `UNCERTAIN` is reachable — an engine that can only emit yes/no fails the
  contract even when its answers happen to be right.
- Roll-up is a floor over mandatory criteria.
- Ran against `eval-fixtures`; the false-eligible rate did not rise.
