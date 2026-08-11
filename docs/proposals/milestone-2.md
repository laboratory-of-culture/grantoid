# Milestone 2 proposal — from ingestion to a product someone can use

Milestone 1 built the floor: schemas, the ladder, tenancy, auth, documents, the
fact registry and its confirmation gate, the source registry, discovery,
classification and grant extraction. 143 tests, of which 28 need Postgres and
skip without it.

What it does not have is the thing the product is *for*. An organization can fill
in a profile and an operator can watch grants arrive, but the two never meet.
Milestone 2 is the join: matching, the feed, the grant screen, and enough
honesty around all three to put them in front of real NGOs.

Companion file: `docs/proposals/milestone-1.md`.

---

## What changed since milestone 1

**The decision to go into trial operation.** The instruction is to keep moving
and settle problems against real usage rather than in advance. That is the right
call for most of what follows — a feed nobody has scrolled is a feed whose
ranking nobody can argue about usefully — but it changes two things.

First, it moves the beta disclosure from a nicety to a correctness requirement.
This product's one non-negotiable claim is that it never overstates what it
knows: an eligibility verdict without a citation is a bug, not a rough edge. A
system that is itself provisional has to hold itself to the same standard it
holds a grant record to. Telling an NGO "you are likely eligible" while the
matcher has never been evaluated against live data, and not saying so, is the
same failure as an uncited verdict — just one level up.

Second, it means several items below ship deliberately unfinished, and the
proposal should say which and how, rather than letting it happen quietly. Each
task carries a "ships incomplete as" note where that applies.

## The binding constraint

**82 seconds per organization × grant pair**, measured on `qwen3:4b` with
reasoning on. That is not a tuning problem; it is the price of the thing that
made the eligibility agent trustworthy in the first place — D6 records that
reasoning is what took unknown-collapse from 50% to 0%.

One organization against 100 grants is 2.3 hours. With two sources publishing
roughly ten items a day and a growing grant table, a feed built by calling the
model on every pair does not exist.

So: **nothing reaches the eligibility agent that a deterministic filter can
settle first.** Sector overlap, geography, applicant type and an open deadline
are all decidable from stored fields with no model at all. The model is then
spent only on pairs where the answer is genuinely in doubt — which is also the
only place it earns its 82 seconds.

The filter must be conservative in one direction only. Excluding a grant an
organization could have won is the expensive mistake and it is invisible; passing
through a grant that turns out ineligible costs one model call. When a profile
field is `UNKNOWN`, the filter passes the pair through — an unanswered question
is not a reason to hide an opportunity, and D4 already says absence cannot
produce a rejection.

## Proposed decisions to record

To go into `docs/DECISIONS.md` as they land, not before:

- **D8 — a deterministic pre-filter gates every eligibility call.** Rationale
  above. The filter's own exclusions must be explainable in the same way a
  verdict is, or the feed acquires a silent second ranking nobody can inspect.
- **D9 — extraction confidence is computed from field coverage, never reported
  by the model.** A model rating its own output rates its fluency. Already
  implemented in `agents/extraction`; the decision needs writing down.
- **D10 — beta status is a product surface, not a footer.** It appears wherever
  the system states a conclusion, not once on a landing page.

## Task list

Ordered. `M2-1` is first because everything after it is shown to someone.

| # | Task | Done when | Ships incomplete as |
|---|---|---|---|
| M2-1 | Beta disclosure surface | A dismissible banner in the app shell, and a persistent marker on every AI conclusion; copy names what is and is not evaluated | — |
| M2-2 | Deterministic pre-filter | Pure functions over stored fields, tested; `UNKNOWN` always passes through; exclusions carry a reason string | Thresholds unvalidated against real feedback |
| M2-3 | Persist matching | `Match` rows written with prompt fingerprint + both content hashes; a cached verdict cannot outlive its inputs | Re-match triggering is manual, not queued |
| M2-4 | Feed generation | A job produces a ranked feed for one organization; four buckets per `explainable-output` | Runs on demand, not on a schedule |
| M2-5 | `/mozhlyvosti` — the feed | Four buckets, no bare scores, each row carries its reason and its action | — |
| M2-6 | `/hranty/[id]` — grant detail | Match breakdown, per-criterion verdicts with both citations, extraction gaps shown as gaps | — |
| M2-7 | Navigation honesty | No nav item leads to a 404; unbuilt sections either hidden or marked | — |
| M2-8 | Live re-run of extraction | Six live items re-extracted after the date/sum corroboration checks | — |
| M2-9 | Email notifications | Digest of new matches; unsubscribe; nothing sent without a verdict and its reason | Weekly only, no per-grant alerts |
| M2-10 | Deploy + privacy policy | D1's promise — documents never leave our infrastructure — written into the policy in the same words | — |

## Revision: the three sections become one editor

The original plan carried «Концепції», «Заявки» and «Вимоги донора» as three
top-level sections, deferred out of this milestone. That structure was wrong,
and greying them out in `M2-7` only made it visible.

None of that work exists in general. You do not write a concept in general — you
write it for one call, against its conditions, before its deadline. As separate
destinations each would have opened on an empty list asking the user to choose a
grant: the screen they had just come from. Three sections, three empty states,
one real action between them.

So they collapse into a **grant editor**, reached from a chosen opportunity, and
that editor is the remaining scope of the beta:

- a concept note generated from the profile and this call, section by section;
- editing, with every untouched section labelled as an AI draft;
- an assistant that improves one section on request rather than rewriting the
  document;
- upload of the donor's own PDFs and documents for this call, which is where the
  conditions that the announcement omits actually live.

That last point closes the gap ingestion cannot: an aggregator announcement gives
`extractionConfidence` around 0.6, and the missing 0.4 is in a PDF on the donor's
site. Nobody should read it speculatively for every call — but the moment an
organization decides to apply, it is exactly the right time to ask for it.

| # | Task | Done when | State |
|---|---|---|---|
| M2-11 | Data model for the editor | `ConceptDraft` / `ConceptSection`, donor documents linked to a grant | done |
| M2-12 | Concept section registry | Eight sections as data, with per-section guidance | done |
| M2-13 | Concept generator agent | Draft from profile + call; nothing invented that neither supplies | |
| M2-14 | Editor screen | Generate, edit, approve per section; AI drafts labelled everywhere | |
| M2-15 | Donor documents in the editor | Upload against the grant, not the profile; conditions extracted from them | |
| M2-16 | Assistant | Improves one section on instruction, shows what it changed | |

Explicitly **not** in the beta: the readiness score and the eight review
dimensions, submission tracking, and anything that exports a document to a
donor. Export in particular waits until `human-in-the-loop` has somewhere to
enforce its rule, which is `M2-14`.

## Debts carried from milestone 1

Small, known, and none of them blocking. Listed so they are not rediscovered as
surprises:

- The `House of Europe` source is a leftover from the original fixture seed —
  disabled and never crawled, but it sits in the operator's registry looking
  like a real source. Its two fixture grants carry English field values that
  would render as-is in a Ukrainian feed.
- Extraction maps `resolvingFactKey` wrongly often enough to notice: a live rule
  about eligible industries was bound to `geographic_coverage`. The rule text and
  its citation were correct; only the field was wrong. Worth an eval fixture
  before it is worth a prompt change.
- ГУРТ listing items have no publication date — it is not in the listing markup.
  Either fetch the detail page for it during extraction or accept the gap
  visibly.
- `scripts/snapshot-pages.ts` writes signed-in pages to a public path for visual
  review. It refuses to run with `NODE_ENV=production`, and that guard is the
  only thing standing between it and an authorization bypass. It should not
  survive to a deployed environment.

## Open question

**One, and it does not block M2-1 through M2-6.**

Matching latency is 82 seconds because reasoning is on, and reasoning is on
because D6 measured it as the difference between holding `UNCERTAIN` and
collapsing it. The pre-filter reduces how many pairs pay that cost; it does not
reduce the cost.

If the filter still leaves more pairs than the hardware can serve, the options
are a larger context of cheaper judgements (batching several criteria per call),
a smaller reasoning budget, or the split that milestone 1 originally proposed and
D1 rejected — a hosted model for the eligibility agent only. The last one
contradicts the privacy promise that D1 makes and that the privacy policy in
M2-10 will state, so it is not a decision to take quietly under deadline
pressure. Worth deciding deliberately once M2-4 produces a real number for how
many pairs survive the filter.
