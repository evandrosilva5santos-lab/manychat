"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { idSchema } from "@/lib/validation";
import { UserFacingError } from "@/lib/user-error";
import type { TenantActor } from "@/lib/tenancy";
import { requirePost, requireProject, requireAutoposterActor, projectScope } from "../access";
import type { PostStatus, ReviewStatus } from "../constants";
import { zonedToUtc } from "../dates";
import { publishPost, recordTimeline, type Actor } from "../runner";
import { mediaTypeFor, postInputSchema, scheduleSchema, nameSchema, type PostInput } from "../schemas";
import {
  afterCancelSchedule,
  afterReviewStatusChange,
  afterSchedule,
  afterSendToReview,
  canEdit,
  initialState,
  reviewStatusFromReviews,
  type PostState,
} from "../state";
import { runAction, type ActionResult } from "./shared";

const agency = (actor: TenantActor): Actor => ({ type: "agency", name: actor.name, email: actor.email });

function stateOf(post: { status: string; reviewStatus: string; scheduledAt: Date | null; publishOnlyIfApproved: boolean }): PostState {
  return {
    status: post.status as PostStatus,
    reviewStatus: post.reviewStatus as ReviewStatus,
    scheduledAt: post.scheduledAt,
    publishOnlyIfApproved: post.publishOnlyIfApproved,
  };
}

function refresh(projectId: string) {
  revalidatePath(`/autoposter/projeto/${projectId}`, "layout");
  revalidatePath("/autoposter");
}

async function resolveGroup(projectId: string, projectName: string, groupId?: string | null, newName?: string | null) {
  if (groupId) {
    const group = await prisma.autoposterReviewGroup.findFirst({ where: { id: groupId, projectId }, select: { id: true } });
    if (!group) throw new UserFacingError("Grupo de aprovação não encontrado.");
    return group.id;
  }
  const group = await prisma.autoposterReviewGroup.create({
    data: { projectId, name: newName || `Posts ${projectName}`, token: randomUUID() },
    select: { id: true },
  });
  return group.id;
}

function validatedTargets(project: { accounts: Array<{ accountId: string }> }, input: PostInput) {
  const allowed = new Set(project.accounts.map((link) => link.accountId));
  if (input.targets.some((target) => !allowed.has(target.accountId))) {
    throw new UserFacingError("Uma das contas escolhidas não pertence a este projeto.");
  }
  const unique = new Map(input.targets.map((target) => [`${target.accountId}:${target.format}`, target]));
  return [...unique.values()].map((target) => ({ accountId: target.accountId, network: "instagram", format: target.format }));
}

async function categoryFor(projectId: string, categoryId: string | null | undefined) {
  if (!categoryId) return null;
  const category = await prisma.autoposterCategory.findFirst({ where: { id: categoryId, projectId }, select: { id: true } });
  return category?.id ?? null;
}

export async function createPost(input: PostInput): Promise<ActionResult<{ id: string }>> {
  return runAction("createPost", async () => {
    const data = postInputSchema.parse(input);
    const { actor, project } = await requireProject(data.projectId);
    const targets = validatedTargets(project, data);
    const scheduledAt = data.schedule ? zonedToUtc(data.schedule.date, data.schedule.time, project.timezone) : null;
    const state = initialState({ scheduledAt, sendToReview: data.sendToReview, publishOnlyIfApproved: data.publishOnlyIfApproved });
    const reviewGroupId = data.sendToReview ? await resolveGroup(project.id, project.name, data.reviewGroupId, data.newReviewGroupName) : null;

    const post = await prisma.autoposterPost.create({
      data: {
        projectId: project.id,
        title: data.title,
        caption: data.caption,
        firstComment: data.firstComment,
        mediaUrls: data.mediaUrls,
        mediaType: mediaTypeFor(data.mediaUrls),
        status: state.status,
        reviewStatus: state.reviewStatus,
        scheduledAt,
        publishOnlyIfApproved: data.publishOnlyIfApproved,
        reviewGroupId,
        categoryId: await categoryFor(project.id, data.categoryId),
        createdById: actor.id,
        createdByName: actor.name,
        targets: { create: targets },
      },
      select: { id: true },
    });
    await recordTimeline(post.id, "post.created", agency(actor));
    if (data.sendToReview) await recordTimeline(post.id, "post.sent_to_review", agency(actor));
    else if (scheduledAt) await recordTimeline(post.id, "post.status_changed.scheduled", agency(actor));
    refresh(project.id);
    return post;
  });
}

export async function updatePost(postId: string, input: PostInput): Promise<ActionResult<{ id: string }>> {
  return runAction("updatePost", async () => {
    const data = postInputSchema.parse(input);
    const { actor, post } = await requirePost(idSchema.parse(postId));
    if (!canEdit(post.status as PostStatus)) throw new UserFacingError("Post publicado não pode ser editado.");
    const { project } = await requireProject(post.projectId, actor);
    const targets = validatedTargets(project, data);
    const scheduledAt = data.schedule ? zonedToUtc(data.schedule.date, data.schedule.time, project.timezone) : null;
    let state: PostState = { ...stateOf(post), publishOnlyIfApproved: data.publishOnlyIfApproved };
    if (["failed", "not_published"].includes(state.status)) state = { ...state, status: "draft" };
    state = scheduledAt ? afterSchedule(state, scheduledAt) : afterCancelSchedule(state);
    let reviewGroupId = post.reviewGroupId;
    const sendingNow = data.sendToReview && post.reviewStatus !== "pending";
    if (sendingNow) {
      reviewGroupId = await resolveGroup(project.id, project.name, data.reviewGroupId ?? post.reviewGroupId, data.newReviewGroupName);
      state = afterSendToReview(state);
    }
    const existing = new Set(post.targets.map((target) => `${target.accountId}:${target.format}`));
    await prisma.$transaction([
      prisma.autoposterPostTarget.deleteMany({
        where: {
          postId: post.id,
          status: { not: "published" },
          NOT: { OR: targets.map((target) => ({ accountId: target.accountId, format: target.format })) },
        },
      }),
      ...targets
        .filter((target) => !existing.has(`${target.accountId}:${target.format}`))
        .map((target) => prisma.autoposterPostTarget.create({ data: { postId: post.id, ...target } })),
      prisma.autoposterPost.update({
        where: { id: post.id },
        data: {
          title: data.title,
          caption: data.caption,
          firstComment: data.firstComment,
          mediaUrls: data.mediaUrls,
          mediaType: mediaTypeFor(data.mediaUrls),
          status: state.status,
          reviewStatus: state.reviewStatus,
          scheduledAt: state.scheduledAt,
          publishOnlyIfApproved: data.publishOnlyIfApproved,
          reviewGroupId,
          categoryId: await categoryFor(project.id, data.categoryId),
        },
      }),
    ]);
    await recordTimeline(post.id, "post.edited", agency(actor));
    if (sendingNow) await recordTimeline(post.id, "post.sent_to_review", agency(actor));
    refresh(project.id);
    return { id: post.id };
  }, "Post atualizado.");
}

export async function sendPostToReview(postId: string, reviewGroupId?: string | null, newGroupName?: string | null): Promise<ActionResult> {
  return runAction("sendPostToReview", async () => {
    const { actor, post } = await requirePost(idSchema.parse(postId));
    if (!canEdit(post.status as PostStatus)) throw new UserFacingError("Este post já foi publicado.");
    const name = newGroupName ? nameSchema.parse(newGroupName) : null;
    const groupId = await resolveGroup(post.projectId, post.project.name, reviewGroupId ?? post.reviewGroupId, name);
    const next = afterSendToReview(stateOf(post));
    await prisma.autoposterPost.update({ where: { id: post.id }, data: { status: next.status, reviewStatus: next.reviewStatus, reviewGroupId: groupId } });
    await recordTimeline(post.id, "post.sent_to_review", agency(actor));
    refresh(post.projectId);
    return undefined;
  }, "Post enviado para aprovação.");
}

export async function reschedulePost(postId: string, schedule: z.infer<typeof scheduleSchema>): Promise<ActionResult> {
  return runAction("reschedulePost", async () => {
    const { actor, post } = await requirePost(idSchema.parse(postId));
    const parsed = scheduleSchema.parse(schedule);
    if (!parsed) throw new UserFacingError("Informe a data e o horário.");
    if (!canEdit(post.status as PostStatus)) throw new UserFacingError("Este post já foi publicado.");
    const scheduledAt = zonedToUtc(parsed.date, parsed.time, post.project.timezone);
    if (scheduledAt.getTime() < Date.now() - 60_000) throw new UserFacingError("Escolha um horário no futuro.");
    const base = ["failed", "not_published"].includes(post.status) ? { ...stateOf(post), status: "draft" as PostStatus } : stateOf(post);
    const next = afterSchedule(base, scheduledAt);
    await prisma.autoposterPost.update({ where: { id: post.id }, data: { status: next.status, scheduledAt } });
    await prisma.autoposterPostTarget.updateMany({ where: { postId: post.id, status: "failed" }, data: { status: "pending", attempts: 0 } });
    await recordTimeline(post.id, "post.schedule_updated", agency(actor));
    refresh(post.projectId);
    return undefined;
  }, "Data de publicação atualizada.");
}

export async function cancelPostSchedule(postId: string): Promise<ActionResult> {
  return runAction("cancelPostSchedule", async () => {
    const { actor, post } = await requirePost(idSchema.parse(postId));
    if (!canEdit(post.status as PostStatus)) throw new UserFacingError("Este post já foi publicado.");
    const next = afterCancelSchedule(stateOf(post));
    await prisma.autoposterPost.update({ where: { id: post.id }, data: { status: next.status, scheduledAt: null } });
    await recordTimeline(post.id, "post.schedule_canceled", agency(actor));
    refresh(post.projectId);
    return undefined;
  }, "Agendamento cancelado.");
}

export async function publishPostNow(postId: string): Promise<ActionResult<{ status: string }>> {
  return runAction("publishPostNow", async () => {
    const { actor, post } = await requirePost(idSchema.parse(postId));
    if (post.status === "published") throw new UserFacingError("Este post já foi publicado.");
    await prisma.autoposterPostTarget.updateMany({ where: { postId: post.id, status: "failed" }, data: { status: "pending", attempts: 0 } });
    const outcome = await publishPost(post.id, agency(actor));
    refresh(post.projectId);
    if (outcome.status !== "published" && outcome.errors[0]) throw new UserFacingError(outcome.errors[0]);
    return { status: outcome.status };
  }, "Post publicado.");
}

const MARKABLE = ["published", "not_published", "draft"] as const;

export async function markPostAs(postId: string, status: (typeof MARKABLE)[number]): Promise<ActionResult> {
  return runAction("markPostAs", async () => {
    const { actor, post } = await requirePost(idSchema.parse(postId));
    const target = z.enum(MARKABLE).parse(status);
    await prisma.autoposterPost.update({
      where: { id: post.id },
      data: { status: target, ...(target === "draft" ? { scheduledAt: null, reviewStatus: "none" } : {}) },
    });
    if (target === "published") {
      await prisma.autoposterPostTarget.updateMany({ where: { postId: post.id }, data: { status: "published", publishedAt: new Date() } });
    }
    await recordTimeline(post.id, `post.status_changed.${target}`, agency(actor), { note: "Alterado manualmente" });
    refresh(post.projectId);
    return undefined;
  }, "Status atualizado.");
}

export async function movePostToGroup(postId: string, reviewGroupId: string | null): Promise<ActionResult> {
  return runAction("movePostToGroup", async () => {
    const { post } = await requirePost(idSchema.parse(postId));
    const groupId = reviewGroupId ? await resolveGroup(post.projectId, post.project.name, idSchema.parse(reviewGroupId)) : null;
    await prisma.autoposterPost.update({ where: { id: post.id }, data: { reviewGroupId: groupId } });
    refresh(post.projectId);
    return undefined;
  }, "Grupo atualizado.");
}

export async function deletePost(postId: string): Promise<ActionResult> {
  return runAction("deletePost", async () => {
    const { post } = await requirePost(idSchema.parse(postId));
    await prisma.autoposterPost.delete({ where: { id: post.id } });
    refresh(post.projectId);
    return undefined;
  }, "Post excluído.");
}

/** "Não reconhece essa revisão? Invalidar." — anula a decisão e recalcula o status. */
export async function invalidateReview(reviewId: string): Promise<ActionResult> {
  return runAction("invalidateReview", async () => {
    const actor = await requireAutoposterActor();
    const review = await prisma.autoposterReview.findFirst({
      where: { id: idSchema.parse(reviewId), invalidatedAt: null, post: { project: projectScope(actor) } },
      include: { post: true },
    });
    if (!review) throw new UserFacingError("Revisão não encontrada.");
    await prisma.autoposterReview.update({ where: { id: review.id }, data: { invalidatedAt: new Date() } });
    const reviews = await prisma.autoposterReview.findMany({ where: { postId: review.postId }, select: { decision: true, invalidatedAt: true, createdAt: true } });
    const post = review.post;
    if (canEdit(post.status as PostStatus) && !["failed", "not_published"].includes(post.status)) {
      const next = afterReviewStatusChange(stateOf(post), reviewStatusFromReviews(reviews, Boolean(post.reviewGroupId)));
      await prisma.autoposterPost.update({ where: { id: post.id }, data: { status: next.status, reviewStatus: next.reviewStatus } });
    }
    await recordTimeline(post.id, "review.invalidated", agency(actor), { reviewId: review.id });
    refresh(post.projectId);
    return undefined;
  }, "Revisão invalidada.");
}
