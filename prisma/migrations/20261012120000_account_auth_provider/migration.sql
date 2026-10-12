-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('INSTAGRAM_LOGIN', 'FACEBOOK_LOGIN');

-- AlterTable
ALTER TABLE "InstagramAccount" ADD COLUMN "authProvider" "AuthProvider" NOT NULL DEFAULT 'INSTAGRAM_LOGIN',
ADD COLUMN "fbPageId" TEXT;

-- Backfill: contas criadas pelo fluxo do Facebook guardam token de Página, que não expira.
UPDATE "InstagramAccount" SET "authProvider" = 'FACEBOOK_LOGIN' WHERE "tokenExpiresAt" IS NULL AND "accessTokenEnc" IS NOT NULL;
