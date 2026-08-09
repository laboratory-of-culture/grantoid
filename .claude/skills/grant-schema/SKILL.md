---
name: grant-schema
description: The canonical grant and organization record shapes, and the rule that every component validates against the schema module instead of redeclaring fields. Use when writing a scraper, extractor, matcher, API response, database migration, or UI type that reads or writes a grant or an organization profile.
---

# Grant schema

One definition, imported everywhere. Drift between the scraper's idea of a grant
and the matcher's idea of a grant is the failure this prevents — it surfaces as
silently dropped eligibility rules, which surface as wrong verdicts.

## Where the truth lives

Current home: `spike/matching/schemas.py` (`Grant`, `EligibilityRule`, `Funding`,
`Source`, `OrganizationProfile`). Planned home once the monorepo exists:
`packages/schemas`, with the Pydantic models generating the TypeScript types
rather than the two being maintained by hand.

Import the models. Do not restate a grant's fields inline in a scraper, a
prompt, an API handler, or a React prop type. If a field you need is missing, add
it to the schema module in the same change.

## Field rules that are easy to get wrong

**`null` means unread, not absent.** A call that does not state a co-financing
requirement gets `funding.cofinancing_required: null`, never `false`. The
difference decides whether the matcher emits `UNCERTAIN` or `MATCH`. Both real
fixtures in `spike/matching/data/grants/` carry nulls for exactly this reason —
see `extraction_notes` on each.

**Every fact carries a `Source`.** `url`, `document`, `page`, and the verbatim
`quote` it was read off. Provenance is why a reviewer can check an extraction
without reopening the donor's PDF, and why the UI can cite rather than assert.
A fact without a source does not enter the record.

**`kind` on an eligibility rule is load-bearing.** `mandatory` gates eligibility,
`preferred` only moves the score, `excluded` describes who or what is ruled out.
The overall verdict is computed over mandatory rules only, so mislabeling a
preferred rule as mandatory turns a good match into a rejection.

**`extraction_confidence` is about the extraction, not the fit.** It records how
much of the call was actually read. A page-only extraction that skipped the
guidelines PDF is around 0.7 and says so in `extraction_notes`.

**`synthetic: true` marks test fixtures.** Nothing in the pipeline treats them
differently; the flag exists so no reader mistakes a test record for a live
funding call. Any hand-authored grant that does not describe a real programme
sets it.

## Grant freshness

Grant information changes — deadlines move, calls close, forms get replaced. Every
record carries `retrieved_at`, and the source-monitoring job compares against it.
A grant shown in the feed without a recent check is a liability; see
`source-ingestion` for the re-check contract.

## Organization profiles

`OrganizationProfile` mirrors the same discipline in the other direction:

- `unknown_fields` lists what the organization has not answered. It is the input
  the matcher uses to emit `UNCERTAIN` instead of guessing.
- `explicit_negatives` lists what the organization has confirmed it does not do
  or have. This is the only thing that justifies `NOT_ELIGIBLE`.
- `legal_status` is a Ukrainian legal form from a fixed set, not free text — see
  `ua-locale`.

An empty list and an unknown field are different states. Do not collapse them.

## Checklist

- Types imported from the schema module, not redeclared.
- New extracted fields carry a `Source` with a verbatim quote.
- Unread call sections produce `null` plus an `extraction_notes` line.
- Rule `kind` set deliberately for every eligibility rule.
- Hand-authored non-real records set `synthetic: true`.
