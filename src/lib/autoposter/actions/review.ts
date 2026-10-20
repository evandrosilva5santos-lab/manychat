"use server";

// Portal público do cliente: sem login. O segredo é o token do grupo (e o do revisor).
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { UserFacingError } from "@/lib/user-error";
import type { PostStatus, ReviewStatus } from "../constants";
import { recordTimeline } from "../runner";
import { decisionsSchema, reviewerSchema } from "../schemas";
import { afterReview, overallDecision } from "../state";
import { runAction, type ActionResult } from "./shared";

const tokenSchema = z.string().uuid("Link inválido.");
const CLOSED: PostStatus[] = ["publishing", "published", "not_published", "failed"];

type DecisionItem = z.infer<typeof decisionsSchema>[number];

/** Resumo da revisão para o histórico: "Arte: aprovada · Legenda: ajuste — trocar o preço". */
function reviewNote(item: DecisionItem): string {
  const media = item.media === "approved" ? "Arte: aprovada" : `Arte: ajuste — ${item.mediaComment ?? ""}`;
  const caption =
    item.caption === "approved" ? "Legenda: aprovada" : item.caption === "edited" ? "Legenda: editada pelo cliente" : `Legenda: ajuste — ${item.captionComment ?? ""}`;
  return `${media}\n${caption}`;
}

async function requireGroupByToken(token: string) {
  const group = await prisma.autoposterReviewGroup.findUnique({ where: { token: tokenSchema.parse(token) } });
  if (!group) throw new UserFacingError("Este link de aprovação não existe ou foi desativado.");
  return group;
}

/** Identifica quem vai revisar (nome + e-mail) e devolve o link pessoal. */
export async function startReview(groupToken: string, input: { name: string; email: string }): Promise<ActionResult<{ reviewerToken: string }>> {
  return runAction("startReview", async () => {
    const group = await requireGroupByToken(groupToken);
    const data = reviewerSchema.parse(input);
    const existing = await prisma.autoposterReviewer.findFirst({ where: { reviewGroupId: group.id, email: data.email } });
    if (existing) {
      if (existing.name !== data.name) await prisma.autoposterReviewer.update({ where: { id: existing.id }, data: { name: data.name } });
      return { reviewerToken: existing.token };
    }
    const reviewer = await prisma.autoposterReviewer.create({
      data: { reviewGroupId: group.id, name: data.name, email: data.email, token: randomUUID() },
      select: { token: true },
    });
    return { reviewerToken: reviewer.token };
  });
}

export async function submitReview(
  groupToken: string,
  reviewerToken: string,
  decisions: z.infer<typeof decisionsSchema>,
): Promise<ActionResult<{ approved: number; adjustments: number }>> {
  return runAction("submitReview", async () => {
    const group = await requireGroupByToken(groupToken);
    const reviewer = await prisma.autoposterReviewer.findFirst({ where: { token: tokenSchema.parse(reviewerToken), reviewGroupId: group.id } });
    if (!reviewer) throw new UserFacingError("Identifique-se novamente para revisar.");
    const items = decisionsSchema.parse(decisions);

    const posts = await prisma.autoposterPost.findMany({
      where: { id: { in: items.map((item) => item.postId) }, reviewGroupId: group.id },
      select: { id: true, projectId: true, caption: true, status: true, reviewStatus: true, scheduledAt: true, publishOnlyIfApproved: true },
    });
    const byId = new Map(posts.map((post) => [post.id, post]));
    const actor = { type: "client" as const, name: reviewer.name, email: reviewer.email };
    let approved = 0;
    let adjustments = 0;

    for (const item of items) {
      const post = byId.get(item.postId);
      if (!post || CLOSED.includes(post.status as PostStatus)) continue;
      const decision = overallDecision(item.media, item.caption);
      const newCaption = item.caption === "edited" ? (item.editedCaption ?? "").trim() : null;
      const review = await prisma.autoposterReview.create({
        data: {
          postId: post.id,
          reviewerId: reviewer.id,
          decision,
          comment: item.mediaComment,
          mediaDecision: item.media,
          captionDecision: item.caption,
          captionComment: item.captionComment,
          editedCaption: newCaption,
        },
        select: { id: true },
      });
      const next = afterReview(
        { status: post.status as PostStatus, reviewStatus: post.reviewStatus as ReviewStatus, scheduledAt: post.scheduledAt, publishOnlyIfApproved: post.publishOnlyIfApproved },
        decision,
      );
      await prisma.autoposterPost.updateMany({
        where: { id: post.id, status: { notIn: CLOSED } },
        data: { status: next.status, reviewStatus: next.reviewStatus, ...(newCaption ? { caption: newCaption } : {}) },
      });
      if (newCaption && newCaption !== post.caption) {
        await recordTimeline(post.id, "review.caption_edited", actor, { note: `Legenda anterior:\n${post.caption || "(vazia)"}`, reviewId: review.id });
      }
      await recordTimeline(post.id, `review.${decision}`, actor, { note: reviewNote(item), reviewId: review.id });
      if (decision === "approved") approved += 1;
      else adjustments += 1;
    }

    await prisma.autoposterReviewer.update({ where: { id: reviewer.id }, data: { submittedAt: new Date() } });
    if (posts[0]) revalidatePath(`/autoposter/projeto/${posts[0].projectId}`, "layout");
    revalidatePath("/autoposter");
    return { approved, adjustments };
  });
}
