// Leituras das páginas do Autoposter. As da agência passam por projectScope;
// as públicas (portal do cliente e calendário compartilhado) pelo token.
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { TenantActor } from "@/lib/tenancy";
import { projectScope } from "./access";
import type { PostStatus } from "./constants";
import { utcRange } from "./dates";

const DAY_MS = 86_400_000;

export const cardSelect = {
  id: true,
  title: true,
  caption: true,
  mediaUrls: true,
  mediaType: true,
  status: true,
  reviewStatus: true,
  scheduledAt: true,
  createdAt: true,
  reviewGroupId: true,
  category: { select: { name: true, color: true } },
  targets: {
    select: { id: true, network: true, format: true, status: true, account: { select: { username: true, profilePicUrl: true } } },
  },
} satisfies Prisma.AutoposterPostSelect;

export type PostCardData = Prisma.AutoposterPostGetPayload<{ select: typeof cardSelect }>;

/** Resumo de "Meus projetos": blocos do topo (últimos N dias) e cards por projeto. */
export async function listProjectsOverview(actor: TenantActor, days = 7, now = new Date()) {
  const since = new Date(now.getTime() - days * DAY_MS);
  const scope = { project: projectScope(actor) };
  const [projects, statusCounts, failures] = await Promise.all([
    prisma.autoposterProject.findMany({
      where: projectScope(actor),
      include: {
        accounts: { include: { account: { select: { id: true, username: true, profilePicUrl: true } } } },
        posts: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.autoposterPost.groupBy({ by: ["projectId", "status"], where: scope, _count: { _all: true } }),
    prisma.autoposterPost.groupBy({
      by: ["projectId"],
      where: { ...scope, status: { in: ["failed", "not_published"] }, updatedAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);

  const [approvedRecent, publishedRecent, scheduledNow, notPublishedRecent, failedRecent, reviewingNow, adjustNow] = await Promise.all([
    prisma.autoposterPost.count({ where: { ...scope, reviewStatus: "approved", updatedAt: { gte: since } } }),
    prisma.autoposterPost.count({ where: { ...scope, status: "published", updatedAt: { gte: since } } }),
    prisma.autoposterPost.count({ where: { ...scope, status: "scheduled" } }),
    prisma.autoposterPost.count({ where: { ...scope, status: "not_published", updatedAt: { gte: since } } }),
    prisma.autoposterPost.count({ where: { ...scope, status: "failed", updatedAt: { gte: since } } }),
    prisma.autoposterPost.count({ where: { ...scope, status: "reviewing" } }),
    prisma.autoposterPost.count({ where: { ...scope, status: "needs_adjustment" } }),
  ]);

  const countFor = (projectId: string, status: PostStatus) =>
    statusCounts.find((row) => row.projectId === projectId && row.status === status)?._count._all ?? 0;

  return {
    since,
    summary: {
      reviewing: reviewingNow,
      adjustments: adjustNow,
      approved: approvedRecent,
      scheduled: scheduledNow,
      published: publishedRecent,
      notPublished: notPublishedRecent,
      failed: failedRecent,
    },
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      logoUrl: project.logoUrl ?? project.accounts[0]?.account.profilePicUrl ?? null,
      accounts: project.accounts.map((link) => link.account),
      scheduled: countFor(project.id, "scheduled"),
      published: countFor(project.id, "published"),
      failures: failures.find((row) => row.projectId === project.id)?._count._all ?? 0,
      lastPostAt: project.posts[0]?.createdAt ?? null,
      createdAt: project.createdAt,
    })),
  };
}

export async function listCalendarPosts(projectId: string, from: string, to: string, timeZone: string, formats?: string[]) {
  const range = utcRange(from, to, timeZone);
  return prisma.autoposterPost.findMany({
    where: {
      projectId,
      scheduledAt: { gte: range.gte, lt: range.lt },
      ...(formats?.length ? { targets: { some: { format: { in: formats } } } } : {}),
    },
    orderBy: { scheduledAt: "asc" },
    select: cardSelect,
  });
}

export const POSTS_PAGE_SIZE = 28;

export async function listPostsPage(projectId: string, status: PostStatus | "all", page: number) {
  const where: Prisma.AutoposterPostWhereInput = { projectId, ...(status === "all" ? {} : { status }) };
  const [posts, total, counts] = await Promise.all([
    prisma.autoposterPost.findMany({
      where,
      orderBy: [{ scheduledAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
      skip: (page - 1) * POSTS_PAGE_SIZE,
      take: POSTS_PAGE_SIZE,
      select: cardSelect,
    }),
    prisma.autoposterPost.count({ where }),
    prisma.autoposterPost.groupBy({ by: ["status"], where: { projectId }, _count: { _all: true } }),
  ]);
  return {
    posts,
    total,
    pages: Math.max(1, Math.ceil(total / POSTS_PAGE_SIZE)),
    counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])) as Partial<Record<PostStatus, number>>,
  };
}

/** Central de posts de todos os projetos do usuário (links "Ver detalhes" do resumo). */
export async function listPostsAcrossProjects(actor: TenantActor, statuses: PostStatus[], page: number) {
  const where: Prisma.AutoposterPostWhereInput = { project: projectScope(actor), ...(statuses.length ? { status: { in: statuses } } : {}) };
  const [posts, total] = await Promise.all([
    prisma.autoposterPost.findMany({
      where,
      orderBy: [{ scheduledAt: { sort: "desc", nulls: "first" } }, { updatedAt: "desc" }],
      skip: (page - 1) * POSTS_PAGE_SIZE,
      take: POSTS_PAGE_SIZE,
      select: { ...cardSelect, project: { select: { timezone: true, dateFormat: true } } },
    }),
    prisma.autoposterPost.count({ where }),
  ]);
  return { posts, pages: Math.max(1, Math.ceil(total / POSTS_PAGE_SIZE)) };
}

export async function listReviewGroups(projectId: string) {
  const groups = await prisma.autoposterReviewGroup.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    include: {
      posts: { select: { id: true, mediaUrls: true, status: true, updatedAt: true }, orderBy: { scheduledAt: "asc" } },
      _count: { select: { reviewers: true } },
    },
  });
  return groups.map((group) => {
    const statuses: Partial<Record<PostStatus, number>> = {};
    for (const post of group.posts) statuses[post.status as PostStatus] = (statuses[post.status as PostStatus] ?? 0) + 1;
    const lastUpdate = group.posts.reduce((latest, post) => (post.updatedAt > latest ? post.updatedAt : latest), group.updatedAt);
    return {
      id: group.id,
      name: group.name,
      token: group.token,
      createdAt: group.createdAt,
      updatedAt: lastUpdate,
      reviewers: group._count.reviewers,
      covers: group.posts.map((post) => post.mediaUrls[0]).filter(Boolean),
      count: group.posts.length,
      statuses,
    };
  });
}

export async function getPostDetail(postId: string, actor: TenantActor) {
  return prisma.autoposterPost.findFirst({
    where: { id: postId, project: projectScope(actor) },
    include: {
      project: { select: { id: true, name: true, timezone: true, dateFormat: true } },
      reviewGroup: { select: { id: true, name: true, token: true } },
      category: { select: { name: true, color: true } },
      targets: { include: { account: { select: { username: true, name: true, profilePicUrl: true } } }, orderBy: { format: "asc" } },
      timeline: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
}

export async function getProjectLibrary(projectId: string) {
  const [hashtags, signatures, categories, groups] = await Promise.all([
    prisma.autoposterHashtagGroup.findMany({ where: { projectId }, orderBy: { name: "asc" } }),
    prisma.autoposterSignature.findMany({ where: { projectId }, orderBy: { name: "asc" } }),
    prisma.autoposterCategory.findMany({ where: { projectId }, orderBy: { name: "asc" } }),
    prisma.autoposterReviewGroup.findMany({ where: { projectId }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true } }),
  ]);
  return { hashtags, signatures, categories, groups };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getReviewGroupByToken(token: string) {
  if (!UUID_RE.test(token)) return null;
  return prisma.autoposterReviewGroup.findUnique({
    where: { token },
    include: {
      project: {
        select: {
          name: true,
          logoUrl: true,
          timezone: true,
          dateFormat: true,
          workspace: { select: { name: true } },
          accounts: { take: 1, include: { account: { select: { profilePicUrl: true } } } },
        },
      },
    },
  });
}

export async function getReviewerByToken(reviewGroupId: string, token: string) {
  if (!UUID_RE.test(token)) return null;
  return prisma.autoposterReviewer.findFirst({ where: { reviewGroupId, token } });
}

export async function listReviewPosts(reviewGroupId: string) {
  return prisma.autoposterPost.findMany({
    where: { reviewGroupId },
    orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    select: {
      ...cardSelect,
      firstComment: true,
      reviews: {
        where: { invalidatedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          decision: true,
          comment: true,
          mediaDecision: true,
          captionDecision: true,
          captionComment: true,
          createdAt: true,
          reviewer: { select: { name: true } },
        },
      },
    },
  });
}

export async function getSharedCalendarProject(token: string) {
  if (!UUID_RE.test(token)) return null;
  return prisma.autoposterProject.findUnique({
    where: { calendarShareToken: token },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      timezone: true,
      dateFormat: true,
      accounts: { take: 1, include: { account: { select: { profilePicUrl: true } } } },
    },
  });
}
