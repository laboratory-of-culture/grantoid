---
name: explainable-output
description: What must ship alongside every AI verdict — the four buckets, verbatim citations on both sides, and the rule that no bare score reaches the UI. Use when building the match breakdown, the feed, notification copy, the concept generator, the reviewer, or any component that renders an AI conclusion.
---

# Explainable output

The product's promise is not "you are eligible". It is *why*, with the evidence,
and an honest account of what is still unknown. A verdict a user cannot check is
a verdict they cannot act on.

Pair with `eligibility-engine`, which governs how a verdict is decided. This
skill governs how it is presented and what has to travel with it.

## The four buckets

Every match breakdown groups criteria into exactly these, in this order:

| Bucket | Contains | Action offered |
|---|---|---|
| Відповідає | `MATCH`, `LIKELY_MATCH` | none |
| Потенційна проблема | `LIKELY_NOT_ELIGIBLE`; `UNCERTAIN` + `AMBIGUOUS_CALL` / `CONFLICTING_EVIDENCE` | read the guidelines; resolve the conflict |
| Не відповідає | `NOT_ELIGIBLE` | none — this is a blocker |
| Невідомо | `UNCERTAIN` + `NO_PROFILE_DATA` | complete the named profile field |

The unknown bucket is never merged into "not matched" and never hidden because it
is empty-looking. It is the bucket that converts a near-miss into a won grant,
and it is the one carrying `resolvingFactKey` — the row offers the action that
resolves it ("додати міжнародного партнера до профілю"), not just the diagnosis.

## Two quotations per row

Each criterion carries `grantQuote` (verbatim from the call) and `profileQuote`
(verbatim from the profile). Quote; never paraphrase into an evidence field.

`profileQuote` is null exactly when the profile does not settle the rule — and
then the verdict is `UNCERTAIN` and `missingInformation` says what the
organization would need to supply. A row with a definite verdict and no profile
quote is a bug, and the schema's check constraint rejects it.

A `grantQuote` that does not appear in the source grant text is a hallucination
regardless of whether the verdict is correct. `eval-fixtures` measures this as
the evidence-citation rate; treat a drop as a release blocker.

## No bare scores

`matchScore` never renders without its criterion breakdown in the same view. A
number alone invites the user to trust it, which is the behaviour the product is
built to avoid.

The same applies everywhere a score-like figure appears: the application
readiness score (§21) renders with its eight dimensions, never as a headline
figure alone, and it is labelled an AI quality assessment — never a prediction of
whether the donor will fund the project.

## Uncertainty is stated, not softened

Copy says what is not known, in the interface's voice, without apology or hedge.

- Good: «Не знаємо, чи має організація міжнародного партнера. Додайте партнера до профілю, щоб перевірити цю умову.»
- Bad: «Можливо, ви підходите» — vague about what is known and what is not.
- Bad: hiding the unknown criterion until the user expands something.

Confidence language mirrors the ladder rung and does not inflate it. `LIKELY_MATCH`
is not written as «відповідає».

## Extraction confidence travels too

A grant assembled from a page without its guidelines PDF carries
`extractionConfidence` well below 1 and an `extractionNotes` line. Where that
affects a verdict, say so on the row rather than presenting a partial extraction
as a complete one — the user should know the difference between "the call rules
this out" and "we have not read the whole call yet".

## Notifications carry the same load

A digest line asserting a match reproduces the overall verdict, the score, and
the single most important open question. A notification that says only «Новий
грант — 91%» violates this skill.

## Checklist

- Four buckets rendered, in order, unknown never merged away.
- Every row shows both quotations, or a null profile quote with an explicit
  "what we need" line.
- Every unknown row offers the profile action that resolves it.
- No score renders without its breakdown.
- Readiness and match scores are labelled assessments, never predictions.
