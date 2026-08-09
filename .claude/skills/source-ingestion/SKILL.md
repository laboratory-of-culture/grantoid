---
name: source-ingestion
description: How to add a donor source and keep it honest — robots and ToS review, rate limits, dedupe key, extraction confidence, and change detection on live calls. Use when adding a crawler for a new site, editing the ingestion pipeline, or debugging a stale or duplicated grant.
---

# Source ingestion

Turning "add House of Europe" into a repeatable task, and keeping the grant
corpus trustworthy once it has more than a handful of rows.

Pipeline: page discovery → content extraction → document detection → parsing →
requirement extraction → validation → `Grant`. Ingestion never runs in a request
— it is queue work.

## Before writing a connector

Fill the `Source` row first. The robots and ToS fields are columns rather than
notes because "did anyone check whether we may crawl this" is the question most
likely to be skipped under delivery pressure, and the answer is not recoverable
after the fact.

- `robotsCheckedAt` / `robotsAllows` — fetch and read `robots.txt` for the paths
  you intend to crawl. Record the date; re-check when the connector breaks.
- `tosReviewedAt` / `tosNote` — read the terms. Some donor sites permit reading
  and forbid republishing; that distinction changes what the product may display,
  not just what it may fetch.
- `rateLimitPerMin` — default 10. These are small institutions, several of them
  wartime-strained. Being a considerate client is not optional.
- `contactEmail` — a real address a donor can write to. Identify the crawler in
  the user agent and point it at that address.

A source is created with `enabled: false`. Turning it on is a separate, deliberate
act after a first extraction has been reviewed.

## Dedupe key

`Source.id` + `externalKey`, unique. `externalKey` is the canonical URL path, not
the title and not the full URL — titles get edited, and query strings pick up
tracking parameters. A call whose path changes is a new record; reconcile by hand
rather than by fuzzy title match, which merges distinct sub-calls of the same
programme.

## Extraction confidence is about the reading, not the fit

`extractionConfidence` records how much of the call was actually read. A public
programme page without its guidelines PDF is around 0.7 and says so in
`extractionNotes`.

**Unread is `null`, never a default.** A call that does not mention co-financing
gets `cofinancingRequired: null`, not `false`. Both real House of Europe fixtures
carry nulls for exactly this reason. The difference decides whether the matcher
emits `UNCERTAIN` or a confident `MATCH`, so a helpful-looking default here
becomes a wrong eligibility verdict three layers away.

Write `extractionNotes` as a list of what was not read. It is displayed to the
user next to any verdict it could affect.

## Every extracted fact carries a source

`Citation` with a required verbatim `quote`, plus the URL and — for PDFs — the
page. No provenance, no record. This is what lets the UI cite instead of assert,
and what lets a reviewer check an extraction without reopening the donor's PDF.

## Requirement extraction

One clause can carry several independently-checkable requirements. The House of
Europe International Cooperation call states applicant type and sector in one
sentence; the fixture splits them into `applicant-non-profit` and
`applicant-sector`, because they resolve against different profile facts and a
single rule cannot carry two `resolvingFactKey`s.

Split when the parts resolve separately. Note the normalization in
`extractionNotes`. Keep the same citation quote on both halves — that is honest,
not duplication.

Set `resolvingFactKey` wherever one profile field settles the rule. It is what
turns a diagnosis into an action on the match breakdown, and it is what lets the
ladder refuse a rejection built on an unanswered question.

## Grants change

Deadlines move, requirements get edited, calls close. Every ingest writes a
`GrantSnapshot` with a content hash and the changed field list.

Re-check on `crawlCadenceHours`. On a detected change, re-run matching for every
organization whose feed contains the grant — a cached verdict is keyed on
`grantContentHash` precisely so it cannot outlive the call it described. A closed
call sets `closedSeenAt` and leaves the feed; it is not deleted, because a user
may have an application in progress against it.

## Failure is loud

A connector that returns zero grants where it previously returned twelve has
broken, not found an empty call list. Record `lastError`, and alert on a
source whose yield drops sharply rather than letting the feed quietly thin out.
