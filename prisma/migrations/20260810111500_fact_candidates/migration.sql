-- Facts an extraction proposed, staged for a person to accept or reject.
--
-- Extraction cannot write OrganizationFact directly: there is one row per key,
-- so a proposal would overwrite an answer the organization already gave.
-- Staging is also what lets several documents propose different values for the
-- same key and be reviewed side by side with their sources.

CREATE TYPE "CandidateStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

CREATE TABLE "FactCandidate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "state" "FactState" NOT NULL,
    "valueText" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "page" INTEGER,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "CandidateStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "acceptedValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactCandidate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FactCandidate_organizationId_status_idx"
  ON "FactCandidate"("organizationId", "status");

CREATE INDEX "FactCandidate_documentId_idx" ON "FactCandidate"("documentId");

ALTER TABLE "FactCandidate" ADD CONSTRAINT "FactCandidate_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FactCandidate" ADD CONSTRAINT "FactCandidate_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Extraction proposes; a person confirms. An agent that could write CONFIRMED
-- would be able to put unreviewed claims into a funding application.
ALTER TABLE "FactCandidate" ADD CONSTRAINT "candidate_is_never_confirmed"
  CHECK ("state" <> 'CONFIRMED');

-- A candidate without its source sentence is unreviewable, and an unreviewable
-- claim is exactly what the confirmation queue exists to prevent.
ALTER TABLE "FactCandidate" ADD CONSTRAINT "candidate_quote_required"
  CHECK (btrim("quote") <> '');

-- A resolved candidate records when. Without it there is no audit trail for who
-- let a fact into the profile.
ALTER TABLE "FactCandidate" ADD CONSTRAINT "resolved_candidate_has_timestamp"
  CHECK ("status" = 'PENDING' OR "resolvedAt" IS NOT NULL);
