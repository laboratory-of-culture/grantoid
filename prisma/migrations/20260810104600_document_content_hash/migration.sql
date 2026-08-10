-- Detects a re-upload of the same file, so an organization is told "this is
-- already here as X" instead of silently accumulating duplicates that the
-- extraction agent would then process twice.
--
-- Unique per organization, not globally: two NGOs may legitimately hold the same
-- donor guidelines PDF, and a global constraint would let one of them learn that
-- the other has it.
ALTER TABLE "Document" ADD COLUMN "contentHash" TEXT NOT NULL;

CREATE UNIQUE INDEX "Document_organizationId_contentHash_key"
  ON "Document"("organizationId", "contentHash");
