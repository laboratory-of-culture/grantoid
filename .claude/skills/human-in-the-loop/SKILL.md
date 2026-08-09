---
name: human-in-the-loop
description: What must be labelled as AI draft or assumption, what requires explicit confirmation before export or submission, and the audit log format. Use when building anything that generates text for an application, exports a document, or records who decided what.
---

# Human in the loop

The operating model is fixed: **AI prepares → human verifies → human approves →
human submits.** The product never submits an application.

That is not caution about model quality. A grant application contains legal,
financial and organizational claims made by the organization in its own name. The
organization is accountable for every sentence, so it has to have seen every
sentence.

## Three labels, three meanings

| Label | Applies to | Ukrainian |
|---|---|---|
| Draft | any generated text not yet reviewed | Чернетка |
| Assumption | a claim the model inferred rather than read | Припущення |
| Unconfirmed | text built on a `SELF_REPORTED` fact | Неперевірені дані |

Assumptions are marked inline, not collected in a footer. A budget line the model
invented because the concept needed one is an assumption sitting in the middle of
a table, and the user has to see it there — a list at the end is read once and
never again.

## The confirmation gate

Before an application or concept is exported, or marked ready to submit:

1. Every fact it states is `CONFIRMED` or `EXPLICIT_NEGATIVE` — see
   `org-knowledge-base`. `SELF_REPORTED` is enough to decide whether a grant
   reaches the feed; it is not enough to state to a donor.
2. Every remaining assumption is either resolved or explicitly accepted.
3. The user confirms, per document, in a dialog that names what they are
   confirming — not a checkbox in a settings page.

The gate is on export, not on generation. Generating a draft full of assumptions
is exactly what the product is for; shipping one to a donor unreviewed is not.

## The reviewer suggests, never edits

AI review findings are suggestions on the user's document. Nothing rewrites the
text in place. An accepted suggestion is an action the user took, and it is
logged as such.

## Eligibility verdicts are advice

The feed and the match breakdown carry no submit action. A verdict of
`NOT_ELIGIBLE` hides a grant from the feed; it does not prevent the organization
from applying. Users know their own situation better than an extraction with
`extractionConfidence: 0.7` does, and an organization that has just signed a
partnership the profile has never heard of should be able to disagree with us.

## Audit log

Append-only. Every entry:

```
{ at, actorType: "user" | "agent", actorId, action,
  subjectType, subjectId, before, after,
  modelTag?, promptFingerprint? }
```

Log at minimum: fact confirmed or corrected, document uploaded or deleted,
application exported, submission marked, verdict overridden by a user, agent run
that produced stored output.

`modelTag` and `promptFingerprint` on agent entries are what make "why did it say
that in March" answerable. Without them the log records that something happened
and not what produced it.

Never log document contents or fact values that could carry personal data — log
the subject id and the transition. See `pii-and-donor-data`.

## What the user can always do

- See which agent produced any generated text, and when.
- See the source of any asserted fact — profile field or grant clause.
- Correct a fact, and have everything derived from it re-derived.
- Disagree with a verdict, and have the disagreement recorded.
- Export their data and delete their account, with documents actually removed.

The first two are `explainable-output`'s job at the UI layer; this skill is why
they are not optional.
