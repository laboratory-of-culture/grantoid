-- DropForeignKey
ALTER TABLE "Grant" DROP CONSTRAINT "Grant_sourceId_fkey";

-- AlterTable
ALTER TABLE "Grant" ADD COLUMN     "ownerOrganizationId" TEXT,
ALTER COLUMN "sourceId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Grant_ownerOrganizationId_idx" ON "Grant"("ownerOrganizationId");

-- AddForeignKey
ALTER TABLE "Grant" ADD CONSTRAINT "Grant_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grant" ADD CONSTRAINT "Grant_ownerOrganizationId_fkey" FOREIGN KEY ("ownerOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

