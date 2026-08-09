-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Verdict" AS ENUM ('MATCH', 'LIKELY_MATCH', 'UNCERTAIN', 'LIKELY_NOT_ELIGIBLE', 'NOT_ELIGIBLE');

-- CreateEnum
CREATE TYPE "UncertaintyReason" AS ENUM ('NO_PROFILE_DATA', 'AMBIGUOUS_CALL', 'CONFLICTING_EVIDENCE');

-- CreateEnum
CREATE TYPE "RuleKind" AS ENUM ('MANDATORY', 'PREFERRED', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "FactState" AS ENUM ('UNKNOWN', 'SELF_REPORTED', 'CONFIRMED', 'EXPLICIT_NEGATIVE');

-- CreateEnum
CREATE TYPE "LegalForm" AS ENUM ('GROMADSKA_ORGANIZATSIYA', 'BLAHODIYNA_ORGANIZATSIYA', 'GROMADSKA_SPILKA', 'KOMUNALNYI_ZAKLAD', 'RELIHIYNA_ORGANIZATSIYA', 'INSHE');

-- CreateEnum
CREATE TYPE "GrantStatus" AS ENUM ('OPEN', 'CLOSED', 'UPCOMING', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('DONOR', 'AGGREGATOR', 'PORTAL', 'NEWSLETTER');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('STATUT', 'REGISTRATION', 'ANNUAL_REPORT', 'PREVIOUS_APPLICATION', 'PROJECT_DESCRIPTION', 'STRATEGY', 'CALL_GUIDELINES', 'OTHER');

-- CreateTable
CREATE TABLE "Citation" (
    "id" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "url" TEXT,
    "page" INTEGER,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "documentId" TEXT,
    "grantFactId" TEXT,
    "organizationFactId" TEXT,
    "eligibilityRuleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Citation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "homepageUrl" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "robotsCheckedAt" TIMESTAMP(3),
    "robotsAllows" BOOLEAN,
    "tosReviewedAt" TIMESTAMP(3),
    "tosNote" TEXT,
    "contactEmail" TEXT,
    "crawlCadenceHours" INTEGER NOT NULL DEFAULT 24,
    "rateLimitPerMin" INTEGER NOT NULL DEFAULT 10,
    "lastCrawledAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grant" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleUk" TEXT,
    "donorName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "applicationUrl" TEXT,
    "status" "GrantStatus" NOT NULL DEFAULT 'UNKNOWN',
    "deadline" TIMESTAMP(3),
    "deadlineIsKnown" BOOLEAN NOT NULL DEFAULT false,
    "fundingMin" DECIMAL(14,2),
    "fundingMax" DECIMAL(14,2),
    "currency" TEXT,
    "cofinancingRequired" BOOLEAN,
    "maxSharePct" DECIMAL(5,2),
    "applicantTypes" TEXT[],
    "applicantGeography" TEXT[],
    "sectors" TEXT[],
    "themes" TEXT[],
    "targetGroups" TEXT[],
    "applicationLanguage" TEXT,
    "extractionConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "extractionNotes" TEXT,
    "synthetic" BOOLEAN NOT NULL DEFAULT false,
    "contentHash" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL,
    "closedSeenAt" TIMESTAMP(3),

    CONSTRAINT "Grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrantEligibilityRule" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "textUk" TEXT,
    "kind" "RuleKind" NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "resolvingFactKey" TEXT,

    CONSTRAINT "GrantEligibilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrantFact" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueText" TEXT,
    "valueJson" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "GrantFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrantSnapshot" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentHash" TEXT NOT NULL,
    "changedFields" TEXT[],
    "rawExtract" JSONB NOT NULL,

    CONSTRAINT "GrantSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrantChunk" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector(1024),

    CONSTRAINT "GrantChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "edrpou" TEXT,
    "legalForm" "LegalForm",
    "nonProfitStatus" BOOLEAN,
    "registeredAt" TIMESTAMP(3),
    "oblast" TEXT,
    "city" TEXT,
    "websiteUrl" TEXT,
    "profileCompleteness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationFact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "state" "FactState" NOT NULL DEFAULT 'UNKNOWN',
    "valueText" TEXT,
    "valueJson" JSONB,
    "confidence" DOUBLE PRECISION,
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extractedAt" TIMESTAMP(3),
    "extractionError" TEXT,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "overall" "Verdict" NOT NULL,
    "matchScore" INTEGER NOT NULL,
    "recommend" BOOLEAN NOT NULL,
    "summary" TEXT NOT NULL,
    "blockers" TEXT[],
    "openQuestions" TEXT[],
    "modelTag" TEXT NOT NULL,
    "promptFingerprint" TEXT NOT NULL,
    "numCtx" INTEGER,
    "seed" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "latencyMs" INTEGER,
    "grantContentHash" TEXT NOT NULL,
    "profileVersionHash" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriterionAssessment" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "verdict" "Verdict" NOT NULL,
    "uncertaintyReason" "UncertaintyReason",
    "rationale" TEXT NOT NULL,
    "grantQuote" TEXT NOT NULL,
    "profileQuote" TEXT,
    "missingInformation" TEXT,
    "resolvingFactKey" TEXT,

    CONSTRAINT "CriterionAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Citation_documentId_idx" ON "Citation"("documentId");

-- CreateIndex
CREATE INDEX "Citation_grantFactId_idx" ON "Citation"("grantFactId");

-- CreateIndex
CREATE INDEX "Citation_organizationFactId_idx" ON "Citation"("organizationFactId");

-- CreateIndex
CREATE INDEX "Citation_eligibilityRuleId_idx" ON "Citation"("eligibilityRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "Source_homepageUrl_key" ON "Source"("homepageUrl");

-- CreateIndex
CREATE INDEX "Grant_status_deadline_idx" ON "Grant"("status", "deadline");

-- CreateIndex
CREATE INDEX "Grant_lastCheckedAt_idx" ON "Grant"("lastCheckedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Grant_sourceId_externalKey_key" ON "Grant"("sourceId", "externalKey");

-- CreateIndex
CREATE UNIQUE INDEX "GrantEligibilityRule_grantId_key_key" ON "GrantEligibilityRule"("grantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "GrantFact_grantId_key_key" ON "GrantFact"("grantId", "key");

-- CreateIndex
CREATE INDEX "GrantSnapshot_grantId_capturedAt_idx" ON "GrantSnapshot"("grantId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GrantChunk_grantId_ordinal_key" ON "GrantChunk"("grantId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_edrpou_key" ON "Organization"("edrpou");

-- CreateIndex
CREATE INDEX "OrganizationFact_organizationId_state_idx" ON "OrganizationFact"("organizationId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationFact_organizationId_key_key" ON "OrganizationFact"("organizationId", "key");

-- CreateIndex
CREATE INDEX "Document_organizationId_kind_idx" ON "Document"("organizationId", "kind");

-- CreateIndex
CREATE INDEX "Match_organizationId_recommend_overall_idx" ON "Match"("organizationId", "recommend", "overall");

-- CreateIndex
CREATE UNIQUE INDEX "Match_organizationId_grantId_promptFingerprint_grantContent_key" ON "Match"("organizationId", "grantId", "promptFingerprint", "grantContentHash", "profileVersionHash");

-- CreateIndex
CREATE INDEX "CriterionAssessment_matchId_idx" ON "CriterionAssessment"("matchId");

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_grantFactId_fkey" FOREIGN KEY ("grantFactId") REFERENCES "GrantFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_organizationFactId_fkey" FOREIGN KEY ("organizationFactId") REFERENCES "OrganizationFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_eligibilityRuleId_fkey" FOREIGN KEY ("eligibilityRuleId") REFERENCES "GrantEligibilityRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grant" ADD CONSTRAINT "Grant_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantEligibilityRule" ADD CONSTRAINT "GrantEligibilityRule_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantFact" ADD CONSTRAINT "GrantFact_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantSnapshot" ADD CONSTRAINT "GrantSnapshot_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantChunk" ADD CONSTRAINT "GrantChunk_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationFact" ADD CONSTRAINT "OrganizationFact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionAssessment" ADD CONSTRAINT "CriterionAssessment_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionAssessment" ADD CONSTRAINT "CriterionAssessment_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "GrantEligibilityRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
