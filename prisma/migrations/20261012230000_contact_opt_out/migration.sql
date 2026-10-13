-- Opt-out de contato (LGPD), portado do item 8a. Só ADICIONA colunas.
-- Reverter: ALTER TABLE "Contact" DROP COLUMN "optedOut", DROP COLUMN "optedOutAt";

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "optedOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "optedOutAt" TIMESTAMP(3);
