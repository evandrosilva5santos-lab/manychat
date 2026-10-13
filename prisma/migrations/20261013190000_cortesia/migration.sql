-- Cortesia: cliente grátis por tempo (ou indeterminado), fora do MRR (ADR-008).
-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "complimentaryUntil" TIMESTAMP(3),
ADD COLUMN     "isComplimentary" BOOLEAN NOT NULL DEFAULT false;
