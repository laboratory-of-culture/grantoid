-- Discovery mechanism per source, and a staging row for what discovery finds.
--
-- `discovery` is separate from `kind` because the two are independent: kind says
-- what a source is, discovery says how to read it. Assuming an aggregator
-- publishes a feed is how you discover at implementation time that it does not —
-- gurt.org.ua has no RSS at all, only an HTML listing.
--
-- SourceItem exists because these sources publish *opportunities*, not grants.
-- The Громадський Простір feed carries procurement tenders, equipment purchases
-- and training schools under the same post type as real grant calls. Something
-- has to read each item and decide, and that decision gets its own row and its
-- own audit trail rather than being an implicit filter buried in a crawler.

CREATE TYPE "Discovery" AS ENUM ('RSS', 'HTML_LIST');
CREATE TYPE "ItemStatus" AS ENUM ('NEW', 'GRANT', 'NOT_GRANT', 'EXTRACTED', 'FAILED');

ALTER TABLE "Source"
  ADD COLUMN "discovery" "Discovery" NOT NULL DEFAULT 'RSS',
  ADD COLUMN "discoveryUrl" TEXT,
  ADD COLUMN "userAgent" TEXT;

-- Platform operator, not an organization role. Membership.role governs what
-- someone may do inside their own NGO; this governs the source registry, which
-- belongs to nobody's organization.
ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SourceItem" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "publishedAt" TIMESTAMP(3),
    "status" "ItemStatus" NOT NULL DEFAULT 'NEW',
    "statusNote" TEXT,
    "grantId" TEXT,
    "contentHash" TEXT NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SourceItem_sourceId_status_idx" ON "SourceItem"("sourceId", "status");
CREATE INDEX "SourceItem_status_discoveredAt_idx" ON "SourceItem"("status", "discoveredAt");
CREATE UNIQUE INDEX "SourceItem_sourceId_externalId_key" ON "SourceItem"("sourceId", "externalId");

ALTER TABLE "SourceItem" ADD CONSTRAINT "SourceItem_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A rejected item says why. Without the note, a low grant count is
-- indistinguishable from a broken classifier.
ALTER TABLE "SourceItem" ADD CONSTRAINT "rejected_item_has_note"
  CHECK ("status" <> 'NOT_GRANT' OR "statusNote" IS NOT NULL);

-- An enabled source must declare where to look and who is asking. A crawler that
-- does not identify itself is one a small NGO portal is right to block.
ALTER TABLE "Source" ADD CONSTRAINT "enabled_source_is_configured"
  CHECK (
    "enabled" = false
    OR ("discoveryUrl" IS NOT NULL AND "userAgent" IS NOT NULL)
  );

-- Enabling a source is a deliberate act after someone has read its robots.txt
-- and its terms. This makes that ordering an invariant instead of a habit.
ALTER TABLE "Source" ADD CONSTRAINT "enabled_source_was_reviewed"
  CHECK (
    "enabled" = false
    OR ("robotsCheckedAt" IS NOT NULL AND "tosReviewedAt" IS NOT NULL)
  );
