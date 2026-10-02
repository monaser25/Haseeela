-- CreateTable
CREATE TABLE IF NOT EXISTS "AccountDeletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isDev" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "ownerToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountDeletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AccountDeletion_userId_key" ON "AccountDeletion"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccountDeletion_status_idx" ON "AccountDeletion"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccountDeletion_status_leaseExpiresAt_idx" ON "AccountDeletion"("status", "leaseExpiresAt");

-- Enable Row Level Security (server-only table, no anon/authenticated client policies)
ALTER TABLE "AccountDeletion" ENABLE ROW LEVEL SECURITY;


