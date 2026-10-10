-- CreateTable
CREATE TABLE "TrackedLink" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contactId" TEXT,
    "flowId" TEXT,
    "nodeId" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "firstClickedAt" TIMESTAMP(3),
    "lastClickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackedLink_code_key" ON "TrackedLink"("code");

-- CreateIndex
CREATE INDEX "TrackedLink_accountId_idx" ON "TrackedLink"("accountId");

-- CreateIndex
CREATE INDEX "TrackedLink_contactId_nodeId_idx" ON "TrackedLink"("contactId", "nodeId");

-- CreateIndex
CREATE INDEX "TrackedLink_flowId_idx" ON "TrackedLink"("flowId");

-- AddForeignKey
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
