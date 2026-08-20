-- AlterTable
ALTER TABLE "User" ADD COLUMN     "digestOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastDigestAt" TIMESTAMP(3),
ADD COLUMN     "unsubscribeToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_unsubscribeToken_key" ON "User"("unsubscribeToken");

