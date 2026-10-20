-- Autoposter (clone do Reportei Flux): redesenho completo das tabelas autoposter_*.
-- As tabelas antigas foram criadas por db push e estavam vazias (0 linhas em 13/10/2026).
DROP TABLE IF EXISTS "autoposter_approvals" CASCADE;
DROP TABLE IF EXISTS "autoposter_timeline" CASCADE;
DROP TABLE IF EXISTS "autoposter_posts" CASCADE;
DROP TABLE IF EXISTS "autoposter_projects" CASCADE;

-- CreateTable
CREATE TABLE "autoposter_projects" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "publishOnlyIfApproved" BOOLEAN NOT NULL DEFAULT true,
    "retryOnFailure" BOOLEAN NOT NULL DEFAULT true,
    "calendarShareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autoposter_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autoposter_project_accounts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "autoposter_project_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autoposter_posts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT,
    "caption" TEXT NOT NULL DEFAULT '',
    "firstComment" TEXT,
    "mediaUrls" TEXT[],
    "mediaType" TEXT NOT NULL DEFAULT 'IMAGE',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewStatus" TEXT NOT NULL DEFAULT 'none',
    "scheduledAt" TIMESTAMP(3),
    "publishOnlyIfApproved" BOOLEAN NOT NULL DEFAULT true,
    "reviewGroupId" TEXT,
    "categoryId" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autoposter_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autoposter_post_targets" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "platformPostId" TEXT,
    "permalink" TEXT,
    "publishedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "autoposter_post_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autoposter_review_groups" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autoposter_review_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autoposter_reviewers" (
    "id" TEXT NOT NULL,
    "reviewGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "autoposter_reviewers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autoposter_reviews" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "autoposter_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autoposter_timeline" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorName" TEXT,
    "actorEmail" TEXT,
    "network" TEXT,
    "format" TEXT,
    "note" TEXT,
    "reviewId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "autoposter_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autoposter_hashtag_groups" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hashtags" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "autoposter_hashtag_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autoposter_signatures" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "autoposter_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autoposter_categories" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "autoposter_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "autoposter_projects_calendarShareToken_key" ON "autoposter_projects"("calendarShareToken");

-- CreateIndex
CREATE INDEX "autoposter_projects_workspaceId_idx" ON "autoposter_projects"("workspaceId");

-- CreateIndex
CREATE INDEX "autoposter_project_accounts_accountId_idx" ON "autoposter_project_accounts"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "autoposter_project_accounts_projectId_accountId_key" ON "autoposter_project_accounts"("projectId", "accountId");

-- CreateIndex
CREATE INDEX "autoposter_posts_projectId_scheduledAt_idx" ON "autoposter_posts"("projectId", "scheduledAt");

-- CreateIndex
CREATE INDEX "autoposter_posts_status_scheduledAt_idx" ON "autoposter_posts"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "autoposter_posts_reviewGroupId_idx" ON "autoposter_posts"("reviewGroupId");

-- CreateIndex
CREATE INDEX "autoposter_post_targets_accountId_idx" ON "autoposter_post_targets"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "autoposter_post_targets_postId_accountId_format_key" ON "autoposter_post_targets"("postId", "accountId", "format");

-- CreateIndex
CREATE UNIQUE INDEX "autoposter_review_groups_token_key" ON "autoposter_review_groups"("token");

-- CreateIndex
CREATE INDEX "autoposter_review_groups_projectId_idx" ON "autoposter_review_groups"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "autoposter_reviewers_token_key" ON "autoposter_reviewers"("token");

-- CreateIndex
CREATE INDEX "autoposter_reviewers_reviewGroupId_idx" ON "autoposter_reviewers"("reviewGroupId");

-- CreateIndex
CREATE INDEX "autoposter_reviews_postId_idx" ON "autoposter_reviews"("postId");

-- CreateIndex
CREATE INDEX "autoposter_reviews_reviewerId_idx" ON "autoposter_reviews"("reviewerId");

-- CreateIndex
CREATE INDEX "autoposter_timeline_postId_createdAt_idx" ON "autoposter_timeline"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "autoposter_hashtag_groups_projectId_idx" ON "autoposter_hashtag_groups"("projectId");

-- CreateIndex
CREATE INDEX "autoposter_signatures_projectId_idx" ON "autoposter_signatures"("projectId");

-- CreateIndex
CREATE INDEX "autoposter_categories_projectId_idx" ON "autoposter_categories"("projectId");

-- AddForeignKey
ALTER TABLE "autoposter_projects" ADD CONSTRAINT "autoposter_projects_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoposter_project_accounts" ADD CONSTRAINT "autoposter_project_accounts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "autoposter_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoposter_project_accounts" ADD CONSTRAINT "autoposter_project_accounts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoposter_posts" ADD CONSTRAINT "autoposter_posts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "autoposter_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoposter_posts" ADD CONSTRAINT "autoposter_posts_reviewGroupId_fkey" FOREIGN KEY ("reviewGroupId") REFERENCES "autoposter_review_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoposter_posts" ADD CONSTRAINT "autoposter_posts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "autoposter_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoposter_post_targets" ADD CONSTRAINT "autoposter_post_targets_postId_fkey" FOREIGN KEY ("postId") REFERENCES "autoposter_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoposter_post_targets" ADD CONSTRAINT "autoposter_post_targets_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoposter_review_groups" ADD CONSTRAINT "autoposter_review_groups_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "autoposter_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoposter_reviewers" ADD CONSTRAINT "autoposter_reviewers_reviewGroupId_fkey" FOREIGN KEY ("reviewGroupId") REFERENCES "autoposter_review_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoposter_reviews" ADD CONSTRAINT "autoposter_reviews_postId_fkey" FOREIGN KEY ("postId") REFERENCES "autoposter_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoposter_reviews" ADD CONSTRAINT "autoposter_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "autoposter_reviewers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoposter_timeline" ADD CONSTRAINT "autoposter_timeline_postId_fkey" FOREIGN KEY ("postId") REFERENCES "autoposter_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoposter_hashtag_groups" ADD CONSTRAINT "autoposter_hashtag_groups_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "autoposter_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoposter_signatures" ADD CONSTRAINT "autoposter_signatures_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "autoposter_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoposter_categories" ADD CONSTRAINT "autoposter_categories_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "autoposter_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
