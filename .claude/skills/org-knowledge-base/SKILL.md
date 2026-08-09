---
name: org-knowledge-base
description: How uploaded documents become structured profile facts — extraction, provenance, and the confirmation gate before a fact may enter an application. Use when building document upload, the extraction agent, the profile screen, or anything that reads OrganizationFact.
---

# Organization knowledge base

An NGO uploads its statute, past applications and annual reports once, and never
retypes them. That is the promise. The risk is that a wrong fact extracted from a
PDF ends up asserted in a funding application under the organization's name.

## Every fact carries provenance

Document → fact means: which document, which page, and the verbatim sentence it
was read from. `Citation` with a required `quote`, enforced by a database check
constraint.

A fact without provenance does not enter the knowledge base. Not "enters with low
confidence" — does not enter. There is no way to review a claim you cannot trace,
and an unreviewable claim in a grant application is the organization's liability,
not ours.

## The four states are not confidence levels

`FactState` describes *kinds of knowledge*, and each licenses different use:

| State | Means | May inform a match | May enter an application |
|---|---|---|---|
| `UNKNOWN` | never asked | yes — as `UNCERTAIN` | no |
| `SELF_REPORTED` | the org said so | yes | no |
| `CONFIRMED` | cited and human-confirmed | yes | yes |
| `EXPLICIT_NEGATIVE` | the org confirmed it does not have this | yes | yes |

Extraction produces `SELF_REPORTED`, never `CONFIRMED`. Only a person clicking
confirm produces `CONFIRMED`, and that writes `confirmedAt` — the database
rejects a `CONFIRMED` row without one, and without at least one citation.

## The confirmation gate

Before a fact is written into a concept note or an application, it must be
`CONFIRMED` or `EXPLICIT_NEGATIVE`. A `SELF_REPORTED` fact is good enough to
decide whether a grant reaches the feed; it is not good enough to state as fact
to a donor.

Surface unconfirmed facts as a review queue on the profile screen — the extracted
sentence beside the source document, with confirm and correct. That review is a
five-minute task that converts an upload into usable institutional knowledge, and
it is where the organization's trust in the system is actually built.

## Extraction does not invent

The extraction agent's output schema requires the quote. A fact whose quote does
not appear in the source document is a hallucination and is rejected at the
boundary — same rule and same check as `grantQuote` on the grant side.

Where a document is ambiguous, the agent leaves the fact `UNKNOWN` and says why.
An `UNKNOWN` fact costs the organization one question later; a wrong
`SELF_REPORTED` fact costs it a rejected application.

## Documents are untrusted input

An uploaded PDF is text the organization did not write, was not read by us, and
may contain instructions aimed at the model. The extraction agent's tool
allowlist is empty for this reason (see `agent-authoring`), and extracted text is
never concatenated into another agent's system prompt — it goes in as data, in a
user turn, clearly delimited.

## Adding a fact key

`FACT_REGISTRY` in `packages/schemas/fact-registry.ts` is the fixed set. Adding a
key requires a backfill migration inserting an `UNKNOWN` row for every existing
organization. Without it those organizations have an *absent* row rather than a
stored `UNKNOWN`, and the eligibility agent loses the distinction
`docs/DECISIONS.md` D4 exists to preserve.

Each key carries `questionUk` — the question as an NGO reads it — because
onboarding asks these directly and machine-translated phrasing is where a
Ukrainian user decides the product was not built for them. See `ua-locale`.

## Facts get stale

A partnership lapses; a non-profit registration is revoked; a team of twelve
becomes a team of four. `documentEvidencePossible: false` on a key marks the
facts no upload can settle — those need re-asking, not re-extracting. Re-confirm
before a submission season rather than trusting a two-year-old confirmation.
