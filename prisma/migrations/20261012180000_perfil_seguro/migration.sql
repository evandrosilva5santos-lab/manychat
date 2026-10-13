-- CreateEnum
CREATE TYPE "DeletionSource" AS ENUM ('META_CALLBACK', 'APP');

-- CreateEnum
CREATE TYPE "DeletionScope" AS ENUM ('PERSON', 'BUSINESS');

-- CreateEnum
CREATE TYPE "DeletionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "InstagramAccount" ADD COLUMN     "connectedAt" TIMESTAMP(3),
ADD COLUMN     "metaUserId" TEXT;

-- CreateTable
CREATE TABLE "DataDeletionRequest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "source" "DeletionSource" NOT NULL,
    "provider" "AuthProvider",
    "metaUserIdHash" TEXT,
    "scope" "DeletionScope" NOT NULL,
    "accountIds" TEXT[],
    "status" "DeletionStatus" NOT NULL DEFAULT 'PENDING',
    "accountsAffected" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DataDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataDeletionRequest_code_key" ON "DataDeletionRequest"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DataDeletionRequest_requestKey_key" ON "DataDeletionRequest"("requestKey");

-- CreateIndex
CREATE INDEX "DataDeletionRequest_status_createdAt_idx" ON "DataDeletionRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "InstagramAccount_metaUserId_idx" ON "InstagramAccount"("metaUserId");

-- CreateIndex
CREATE INDEX "WebhookEvent_accountId_idx" ON "WebhookEvent"("accountId");


-- Backfill: eventos antigos passam a apontar para a conta pelo prefixo da
-- chave de idempotência (ig:{igUserId}:...), para a tela de falhas e a exclusão.
UPDATE "WebhookEvent" AS e
SET "accountId" = a."id"
FROM "InstagramAccount" AS a
WHERE e."accountId" IS NULL
  AND e."idempotencyKey" LIKE 'ig:' || a."igUserId" || ':%';
