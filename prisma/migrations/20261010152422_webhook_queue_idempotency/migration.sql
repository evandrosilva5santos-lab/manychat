-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'DONE', 'FAILED', 'DEAD');

-- DropIndex
DROP INDEX "Edge_sourceNodeId_sourceHandle_targetNodeId_key";

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "lastMessageAt" TIMESTAMP(3),
ADD COLUMN     "lastMessagePreview" TEXT;

-- AlterTable
ALTER TABLE "Flow" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_idempotencyKey_key" ON "WebhookEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_nextAttemptAt_idx" ON "WebhookEvent"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "Contact_sourceFlowId_idx" ON "Contact"("sourceFlowId");

-- CreateIndex
CREATE INDEX "FlowRun_contactId_currentNodeId_status_idx" ON "FlowRun"("contactId", "currentNodeId", "status");

-- CreateIndex
CREATE INDEX "FlowRun_triggerId_idx" ON "FlowRun"("triggerId");

-- CreateIndex
CREATE INDEX "FlowRun_currentNodeId_idx" ON "FlowRun"("currentNodeId");

-- CreateIndex
CREATE INDEX "Message_accountId_createdAt_idx" ON "Message"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_runId_idx" ON "Message"("runId");

-- CreateIndex
CREATE INDEX "Message_nodeId_idx" ON "Message"("nodeId");

-- CreateIndex
CREATE INDEX "Trigger_startNodeId_idx" ON "Trigger"("startNodeId");

-- CreateIndex
CREATE INDEX "Trigger_type_mediaId_idx" ON "Trigger"("type", "mediaId");

-- ─────────────────────────────────────────────────────────────
-- Índices únicos PARCIAIS (não representáveis no schema.prisma).
-- Nota: futuros `prisma migrate dev` podem sugerir dropá-los por não
-- enxergá-los no datamodel — NÃO remover (ver docs/DECISIONS.md).
-- ─────────────────────────────────────────────────────────────

-- Máximo UM run ativo por (contato, fluxo): impede execução duplicada
-- e dupla retomada por clique.
CREATE UNIQUE INDEX "FlowRun_active_contact_flow_uniq"
  ON "FlowRun"("contactId", "flowId")
  WHERE "status" IN ('RUNNING', 'WAITING_CLICK', 'WAITING_DELAY');

-- Arestas sem duplicata também quando sourceHandle é NULL (no Prisma,
-- NULLs são distintos entre si e a unique antiga deixava passar cópias).
CREATE UNIQUE INDEX "Edge_source_handle_uniq"
  ON "Edge"("sourceNodeId", "sourceHandle", "targetNodeId")
  WHERE "sourceHandle" IS NOT NULL;

CREATE UNIQUE INDEX "Edge_source_no_handle_uniq"
  ON "Edge"("sourceNodeId", "targetNodeId")
  WHERE "sourceHandle" IS NULL;
