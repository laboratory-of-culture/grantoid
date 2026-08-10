-- Append-only record of who decided what.
--
-- The compliance backbone for a product whose failure mode is a confidently
-- wrong claim made in an organization's name. Deliberately records the subject
-- and the transition, never the content: a fact's value or a document's text in
-- here would put personal data somewhere with no deletion path.

CREATE TYPE "ActorType" AS ENUM ('USER', 'AGENT', 'SYSTEM');

CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "fromState" TEXT,
    "toState" TEXT,
    "modelTag" TEXT,
    "promptFingerprint" TEXT,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditEntry_organizationId_at_idx" ON "AuditEntry"("organizationId", "at");
CREATE INDEX "AuditEntry_subjectType_subjectId_idx" ON "AuditEntry"("subjectType", "subjectId");

-- Append-only in practice as well as in intent: nothing in the application
-- updates or deletes an entry, and a revoked grant here would be the first sign
-- that something is rewriting history.
REVOKE UPDATE, DELETE ON "AuditEntry" FROM PUBLIC;
