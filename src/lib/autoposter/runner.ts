// Executor do agendamento: chamado pelo cron (/api/cron/autoposter) e por "Publicar agora".
import { prisma } from "@/lib/prisma";
import { getEntitlements } from "@/lib/billing/entitlements";
import { hasFeature } from "@/lib/billing/plan-rules";
import { resolveAccountToken } from "@/lib/meta/account-client";
import { PUBLISH_MAX_ATTEMPTS, type MediaType, type PostFormat, type PostStatus, type ReviewStatus } from "./constants";
import { finalStatusFromTargets, publishDecision } from "./state";
import { publishToInstagram } from "./publisher";

export type Actor = { type: "agency" | "client" | "system"; name?: string | null; email?: string | null };

const SYSTEM: Actor = { type: "system" };
const RETRY_DELAY_MS = 60_000;
const STALE_PUBLISHING_MS = 10 * 60_000;
const ACTIVE: PostStatus[] = ["scheduled", "reviewing", "needs_adjustment", "approved"];

export async function recordTimeline(
  postId: string,
  code: string,
  actor: Actor,
  extra: { note?: string | null; network?: string | null; format?: string | null; reviewId?: string | null } = {},
) {
  await prisma.autoposterTimeline.create({
    data: {
      postId,
      code,
      actorType: actor.type,
      actorName: actor.name ?? null,
      actorEmail: actor.email ?? null,
      note: extra.note ?? null,
      network: extra.network ?? null,
      format: extra.format ?? null,
      reviewId: extra.reviewId ?? null,
    },
  });
}

export type PublishOutcome = { status: PostStatus; errors: string[]; retrying: boolean };

/** Publica todas as redes pendentes do post. Idempotente: só um processo "pega" o post. */
export async function publishPost(postId: string, actor: Actor = SYSTEM, now = new Date()): Promise<PublishOutcome> {
  const post = await prisma.autoposterPost.findUnique({ where: { id: postId }, include: { targets: true, project: true } });
  if (!post) return { status: "failed", errors: ["Post não encontrado."], retrying: false };
  const previous = post.status as PostStatus;

  const claimed = await prisma.autoposterPost.updateMany({
    where: { id: postId, status: { notIn: ["publishing", "published"] } },
    data: { status: "publishing" },
  });
  if (claimed.count === 0) return { status: previous, errors: [], retrying: false };
  await recordTimeline(postId, "post.status_changed.publishing", actor);

  const errors: string[] = [];
  let retryable = false;
  for (const target of post.targets.filter((item) => item.status !== "published")) {
    const attempts = target.attempts + 1;
    let result: Awaited<ReturnType<typeof publishToInstagram>>;
    try {
      const account = await resolveAccountToken(target.accountId);
      result = await publishToInstagram({
        igUserId: account.igUserId,
        token: account.token,
        provider: account.provider,
        format: target.format as PostFormat,
        mediaType: post.mediaType as MediaType,
        mediaUrls: post.mediaUrls,
        caption: post.caption,
        firstComment: post.firstComment,
      });
      if (!result.ok && result.expired) await account.markExpired();
    } catch (error) {
      result = { ok: false, error: error instanceof Error ? error.message : "Conta indisponível.", retryable: false, expired: false };
    }

    if (result.ok) {
      await prisma.autoposterPostTarget.update({
        where: { id: target.id },
        data: { status: "published", platformPostId: result.mediaId, permalink: result.permalink, publishedAt: new Date(), failureReason: result.warning ?? null, attempts },
      });
      await recordTimeline(postId, "post.target_published", SYSTEM, { network: target.network, format: target.format, note: result.warning });
    } else {
      const canRetry = result.retryable && post.project.retryOnFailure && attempts < PUBLISH_MAX_ATTEMPTS;
      retryable ||= canRetry;
      errors.push(result.error);
      await prisma.autoposterPostTarget.update({
        where: { id: target.id },
        data: { status: canRetry ? "pending" : "failed", failureReason: result.error, attempts },
      });
      if (!canRetry) await recordTimeline(postId, "post.target_failed", SYSTEM, { network: target.network, format: target.format, note: result.error });
    }
  }

  if (retryable) {
    const back: PostStatus = ACTIVE.includes(previous) ? previous : "scheduled";
    await prisma.autoposterPost.update({ where: { id: postId }, data: { status: back, scheduledAt: new Date(now.getTime() + RETRY_DELAY_MS) } });
    return { status: back, errors, retrying: true };
  }

  const fresh = await prisma.autoposterPostTarget.findMany({ where: { postId }, select: { status: true } });
  const final = finalStatusFromTargets(fresh.map((item) => item.status));
  await prisma.autoposterPost.update({ where: { id: postId }, data: { status: final } });
  await recordTimeline(postId, `post.status_changed.${final}`, SYSTEM, { note: errors[0] ?? null });
  return { status: final, errors, retrying: false };
}

export type RunSummary = { checked: number; published: number; failed: number; notPublished: number; retrying: number; recovered: number };

/** Processa os posts vencidos. Limite por execução para caber no tempo da função. */
export async function processDuePosts(now = new Date(), limit = 10): Promise<RunSummary> {
  const summary: RunSummary = { checked: 0, published: 0, failed: 0, notPublished: 0, retrying: 0, recovered: 0 };

  const stale = await prisma.autoposterPost.updateMany({
    where: { status: "publishing", updatedAt: { lt: new Date(now.getTime() - STALE_PUBLISHING_MS) } },
    data: { status: "failed" },
  });
  summary.recovered = stale.count;

  const due = await prisma.autoposterPost.findMany({
    where: { status: { in: ACTIVE }, scheduledAt: { lte: now } },
    orderBy: { scheduledAt: "asc" },
    take: limit,
    select: { id: true, status: true, reviewStatus: true, scheduledAt: true, publishOnlyIfApproved: true, project: { select: { workspaceId: true } } },
  });

  // Plano (ADR-010): sem o recurso ou com a assinatura bloqueada, o post espera (nada é apagado).
  const allowed = new Map<string, boolean>();
  for (const post of due) {
    summary.checked += 1;
    const workspaceId = post.project.workspaceId;
    if (!allowed.has(workspaceId)) allowed.set(workspaceId, hasFeature(await getEntitlements(workspaceId, now), "autoposter"));
    if (!allowed.get(workspaceId)) continue;
    const decision = publishDecision(
      { status: post.status as PostStatus, reviewStatus: post.reviewStatus as ReviewStatus, scheduledAt: post.scheduledAt, publishOnlyIfApproved: post.publishOnlyIfApproved },
      now,
    );
    if (decision === "skip_not_approved") {
      const updated = await prisma.autoposterPost.updateMany({ where: { id: post.id, status: post.status }, data: { status: "not_published" } });
      if (updated.count > 0) {
        summary.notPublished += 1;
        await recordTimeline(post.id, "post.status_changed.not_published", SYSTEM, { note: "O post não foi publicado porque não foi aprovado a tempo." });
      }
      continue;
    }
    if (decision !== "publish") continue;
    const outcome = await publishPost(post.id, SYSTEM, now);
    if (outcome.retrying) summary.retrying += 1;
    else if (outcome.status === "published") summary.published += 1;
    else summary.failed += 1;
  }
  return summary;
}
