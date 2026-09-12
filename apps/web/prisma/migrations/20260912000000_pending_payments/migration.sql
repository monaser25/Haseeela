-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "expectedDate" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transaction_userId_status_idx" ON "Transaction"("userId", "status");

-- Redefine unique constraint from (userId, sourceType, sourceId, date) to (userId, sourceType, sourceId, sourceBillingDate)
DROP INDEX IF EXISTS "Transaction_userId_sourceType_sourceId_date_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_userId_sourceType_sourceId_sourceBillingDate_key"
ON "Transaction"("userId", "sourceType", "sourceId", "sourceBillingDate");
