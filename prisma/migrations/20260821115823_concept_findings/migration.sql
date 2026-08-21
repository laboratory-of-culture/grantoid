-- CreateEnum
CREATE TYPE "FindingCategory" AS ENUM ('UNSUPPORTED', 'VAGUE', 'MARKETING', 'OFF_TOPIC', 'LONG_SENTENCE');

-- CreateEnum
CREATE TYPE "FindingSource" AS ENUM ('RULE', 'AI');

-- CreateTable
CREATE TABLE "ConceptFinding" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "sectionContentHash" TEXT NOT NULL,
    "category" "FindingCategory" NOT NULL,
    "quote" TEXT NOT NULL,
    "whyUk" TEXT NOT NULL,
    "suggestionUk" TEXT,
    "source" "FindingSource" NOT NULL,
    "dismissedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConceptFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConceptFinding_draftId_sectionKey_idx" ON "ConceptFinding"("draftId", "sectionKey");

-- AddForeignKey
ALTER TABLE "ConceptFinding" ADD CONSTRAINT "ConceptFinding_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ConceptDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
