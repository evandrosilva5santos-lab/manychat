"use server";

import { prisma } from "@/lib/prisma";
import { idSchema } from "@/lib/validation";
import { UserFacingError } from "@/lib/user-error";
import { requireAutoposterActor } from "../access";
import type { PostStatus } from "../constants";
import { formatDateTime, formatTimelineDate, timeInZone, ymdInZone } from "../dates";
import { getPostDetail } from "../queries";
import { canEdit } from "../state";
import { runAction, type ActionResult } from "./shared";

export type PostDetailDTO = {
  id: string;
  projectId: string;
  title: string | null;
  caption: string;
  firstComment: string | null;
  mediaUrls: string[];
  mediaType: string;
  status: PostStatus;
  reviewStatus: string;
  when: string | null;
  scheduleDate: string | null;
  scheduleTime: string | null;
  publishOnlyIfApproved: boolean;
  editable: boolean;
  reviewGroup: { id: string; name: string; token: string } | null;
  groups: Array<{ id: string; name: string }>;
  targets: Array<{ id: string; network: string; format: string; status: string; username: string; profilePicUrl: string | null; failureReason: string | null; permalink: string | null }>;
  timeline: Array<{ id: string; when: string; code: string; actorType: string; actorName: string | null; actorEmail: string | null; network: string | null; format: string | null; note: string | null; reviewId: string | null; reviewValid: boolean }>;
};

export async function loadPostDetail(postId: string): Promise<ActionResult<PostDetailDTO>> {
  return runAction("loadPostDetail", async () => {
    const actor = await requireAutoposterActor();
    const post = await getPostDetail(idSchema.parse(postId), actor);
    if (!post) throw new UserFacingError("Post não encontrado.");
    const { timezone, dateFormat } = post.project;
    const [groups, validReviews] = await Promise.all([
      prisma.autoposterReviewGroup.findMany({ where: { projectId: post.projectId }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true } }),
      prisma.autoposterReview.findMany({ where: { postId: post.id, invalidatedAt: null }, select: { id: true } }),
    ]);
    const valid = new Set(validReviews.map((review) => review.id));
    return {
      id: post.id,
      projectId: post.projectId,
      title: post.title,
      caption: post.caption,
      firstComment: post.firstComment,
      mediaUrls: post.mediaUrls,
      mediaType: post.mediaType,
      status: post.status as PostStatus,
      reviewStatus: post.reviewStatus,
      when: post.scheduledAt ? formatDateTime(post.scheduledAt, timezone, dateFormat).replace(" ", " às ") : null,
      scheduleDate: post.scheduledAt ? ymdInZone(post.scheduledAt, timezone) : null,
      scheduleTime: post.scheduledAt ? timeInZone(post.scheduledAt, timezone) : null,
      publishOnlyIfApproved: post.publishOnlyIfApproved,
      editable: canEdit(post.status as PostStatus),
      reviewGroup: post.reviewGroup,
      groups,
      targets: post.targets.map((target) => ({
        id: target.id,
        network: target.network,
        format: target.format,
        status: target.status,
        username: target.account.username,
        profilePicUrl: target.account.profilePicUrl,
        failureReason: target.failureReason,
        permalink: target.permalink,
      })),
      timeline: post.timeline.map((entry) => ({
        id: entry.id,
        when: formatTimelineDate(entry.createdAt, timezone, dateFormat),
        code: entry.code,
        actorType: entry.actorType,
        actorName: entry.actorName,
        actorEmail: entry.actorEmail,
        network: entry.network,
        format: entry.format,
        note: entry.note,
        reviewId: entry.reviewId,
        reviewValid: entry.reviewId ? valid.has(entry.reviewId) : false,
      })),
    };
  });
}
