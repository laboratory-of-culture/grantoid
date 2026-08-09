-- The evidence rules from the eligibility-contract, enforced at the last layer
-- that can refuse a write.
--
-- Zod already checks these at the agent boundary. They are repeated here because
-- the agent boundary is not the only way a row can be created — a backfill, a
-- fixture loader, a future admin action or a direct SQL fix all bypass it, and
-- a wrong eligibility verdict is the one defect this product cannot ship.

-- An UNCERTAIN verdict must say why. NO_PROFILE_DATA offers the organization a
-- profile action; the other two reasons do not, and the UI buckets on that
-- difference (docs/DECISIONS.md D2).
ALTER TABLE "CriterionAssessment"
  ADD CONSTRAINT "uncertain_requires_reason"
  CHECK (
    "verdict" <> 'UNCERTAIN'
    OR "uncertaintyReason" IS NOT NULL
  );

-- Conversely, a reason only makes sense on an UNCERTAIN verdict.
ALTER TABLE "CriterionAssessment"
  ADD CONSTRAINT "reason_only_when_uncertain"
  CHECK (
    "verdict" = 'UNCERTAIN'
    OR "uncertaintyReason" IS NULL
  );

-- A verdict definite enough to act on must quote the profile text it was read
-- from. A definite verdict with no profile evidence is the shape a hallucinated
-- eligibility call takes, so it is rejected rather than stored.
ALTER TABLE "CriterionAssessment"
  ADD CONSTRAINT "definite_verdict_requires_profile_quote"
  CHECK (
    "verdict" = 'UNCERTAIN'
    OR ("profileQuote" IS NOT NULL AND btrim("profileQuote") <> '')
  );

-- Every criterion cites the grant clause it was judged against. Whether the
-- quote is verbatim is checked by the eval harness; that it exists is checked
-- here.
ALTER TABLE "CriterionAssessment"
  ADD CONSTRAINT "grant_quote_required"
  CHECK (btrim("grantQuote") <> '');

-- A citation that cannot show its words is not a citation.
ALTER TABLE "Citation"
  ADD CONSTRAINT "citation_quote_required"
  CHECK (btrim("quote") <> '');

-- An UNKNOWN fact carries no value. If there is a value, the state is
-- SELF_REPORTED or CONFIRMED — see docs/DECISIONS.md D4.
ALTER TABLE "OrganizationFact"
  ADD CONSTRAINT "unknown_fact_has_no_value"
  CHECK (
    "state" <> 'UNKNOWN'
    OR ("valueText" IS NULL AND "valueJson" IS NULL)
  );

-- A CONFIRMED fact is one a human signed off on. Without the timestamp there is
-- no audit trail, and the human-in-the-loop gate has nothing to check.
ALTER TABLE "OrganizationFact"
  ADD CONSTRAINT "confirmed_fact_has_timestamp"
  CHECK (
    "state" <> 'CONFIRMED'
    OR "confirmedAt" IS NOT NULL
  );

-- Match scores are a percentage of fit, not an unbounded number.
ALTER TABLE "Match"
  ADD CONSTRAINT "match_score_in_range"
  CHECK ("matchScore" >= 0 AND "matchScore" <= 100);
