-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPERADMIN', 'CLIENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- AlterTable: nullable only during this migration's data backfill.
ALTER TABLE "InstagramAccount" ADD COLUMN "workspaceId" TEXT;

-- Preserve all historic account data inside one recoverable legacy workspace.
-- These fixed identifiers are migration-owned records and are not credentials.
INSERT INTO "User" ("id", "name", "email", "role")
VALUES ('legacy-superadmin', 'Legacy Administrator', 'legacy-admin@fluxo.local', 'SUPERADMIN');

INSERT INTO "Workspace" ("id", "name", "ownerId")
VALUES ('legacy-workspace', 'Legacy Workspace', 'legacy-superadmin');

UPDATE "InstagramAccount"
SET "workspaceId" = 'legacy-workspace'
WHERE "workspaceId" IS NULL;

-- The backfill completed above, so every connected account has a tenant.
ALTER TABLE "InstagramAccount" ALTER COLUMN "workspaceId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");

-- CreateIndex
CREATE INDEX "UserSession_userId_expiresAt_idx" ON "UserSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "InstagramAccount_workspaceId_idx" ON "InstagramAccount"("workspaceId");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramAccount" ADD CONSTRAINT "InstagramAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
