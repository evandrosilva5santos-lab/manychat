-- Modelos de pagamento (ADR-009): preço anual, forma de cobrança, ciclo e pagamentos recebidos. Só acrescenta.
-- CreateEnum
CREATE TYPE "BillingMode" AS ENUM ('STRIPE', 'MANUAL', 'COMPLIMENTARY');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'PIX', 'BOLETO', 'TRANSFER', 'CASH', 'OTHER');

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "priceYearlyCents" INTEGER,
ADD COLUMN     "stripeYearlyPriceId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "billingMode" "BillingMode" NOT NULL DEFAULT 'STRIPE';

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'brl',
    "method" "PaymentMethod" NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "stripeInvoiceId" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_stripeInvoiceId_key" ON "SubscriptionPayment"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_workspaceId_paidAt_idx" ON "SubscriptionPayment"("workspaceId", "paidAt");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_paidAt_idx" ON "SubscriptionPayment"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_stripeYearlyPriceId_key" ON "Plan"("stripeYearlyPriceId");

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Cortesias já existentes passam a ter a forma de cobrança correspondente.
UPDATE "Subscription" SET "billingMode" = 'COMPLIMENTARY' WHERE "isComplimentary" = true;
