---
name: pii-and-donor-data
description: What organization data never leaves our infrastructure, how documents are stored and deleted, and what may be logged. Use when adding storage, logging, telemetry, an export, a third-party integration, or any model call that touches uploaded documents.
---

# Organization data

`docs/DECISIONS.md` D1 commits to local inference: NGO documents are processed on
infrastructure we control. That is a promise made to a sector where some
organizations work in occupied or frontline areas, and where a leaked partner
list or beneficiary record is not an embarrassment but a safety problem.

Write it into the privacy policy from the start. It is one of the few genuine
differentiators against a hosted competitor, and it is worthless if it is not
stated in terms an NGO can rely on.

## What must not leave

- Uploaded documents and any text extracted from them.
- Organization facts, including partner names and previous donors.
- Application and concept drafts.
- Anything identifying a beneficiary, a staff member, or a location of work.

That list constrains model calls (local runtime only), error reporting (no
request bodies to a third-party tracker), analytics (no document text, no fact
values), and any future integration.

If a task ever needs a hosted model, it is a decision recorded in
`DECISIONS.md` with the data class named — not a config change. See
`model-runtime`.

## Grant data is different

Donor calls are public. Grant records, eligibility rules and citations may be
logged, cached and shared freely. Keeping this boundary explicit is what lets
ingestion be debugged with real data while profile extraction cannot be.

The pairing is what is sensitive: "which organization is looking at which call"
reveals an organization's plans. Do not put organization ids and grant ids
together in third-party telemetry.

## Logging

Log ids and transitions, never values. `OrganizationFact` id and a state change,
not the fact's text. Document id and a page count, not a page.

Prompts sent to a model contain profile text by construction. Do not log prompts
in production. In development, log them only under an explicit flag, and only
against synthetic fixtures — `evals/fixtures/` exists partly so debugging never
needs a real organization's statute.

## Storage and deletion

- Documents in object storage, not in the database, addressed by `storageKey`.
- Deleting an organization deletes its documents from object storage — not only
  the rows referencing them. A cascade that leaves orphaned files is a deletion
  that did not happen.
- Deletion is exercised in a test. An untested delete path is a promise nobody
  has checked.
- Export gives the organization its own data in a form it can use: profile facts
  with sources, documents, drafts.

## Consent

No training on customer documents, ever, without explicit opt-in — brief §44.
With a local runtime nothing is sent anywhere for training by default, which
makes this easy to honour and easy to state plainly.

If a fine-tune or an eval set is ever built from real organization data, it is
opt-in per organization, revocable, and recorded in the audit log.

## Uploaded documents are untrusted

A PDF is text the organization did not write and we have not read. It may carry
instructions aimed at a model. Extracted text goes into a prompt as delimited
data in a user turn, never concatenated into a system prompt, and the extraction
agent's tool allowlist is empty — see `agent-authoring`.

## Multi-tenancy

Organization-level isolation on every query. A missing `organizationId` filter is
a data breach, not a bug — enforce it at the data-access layer rather than
relying on each route to remember, and test it with two organizations rather than
one.
