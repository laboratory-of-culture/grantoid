-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('DRAFT', 'REVIEWED');

-- CreateEnum
CREATE TYPE "SectionSource" AS ENUM ('AI_DRAFT', 'HUMAN_EDITED', 'HUMAN');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "grantId" TEXT;

-- CreateTable
CREATE TABLE "ConceptDraft" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'DRAFT',
    "modelTag" TEXT,
    "promptFingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConceptDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptSection" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "source" "SectionSource" NOT NULL DEFAULT 'AI_DRAFT',
    "editedAt" TIMESTAMP(3),
    "editedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "ConceptSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConceptDraft_organizationId_status_idx" ON "ConceptDraft"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptDraft_organizationId_grantId_key" ON "ConceptDraft"("organizationId", "grantId");

-- CreateIndex
CREATE INDEX "ConceptSection_draftId_orderIndex_idx" ON "ConceptSection"("draftId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptSection_draftId_key_key" ON "ConceptSection"("draftId", "key");

-- CreateIndex
CREATE INDEX "Document_grantId_idx" ON "Document"("grantId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptDraft" ADD CONSTRAINT "ConceptDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptDraft" ADD CONSTRAINT "ConceptDraft_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptSection" ADD CONSTRAINT "ConceptSection_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ConceptDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
