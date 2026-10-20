// Máquina de estados do post, sem I/O. Regras extraídas do Flux:
// - aprovado + com data = "Agendado" (com ✓); aprovado sem data = "Aprovado";
// - "publicar só se aprovado" e sem aprovação na hora → "Não publicado".
import type { PostStatus, ReviewDecision, ReviewStatus } from "./constants";

export type PostState = {
  status: PostStatus;
  reviewStatus: ReviewStatus;
  scheduledAt: Date | null;
  publishOnlyIfApproved: boolean;
};

const LOCKED: PostStatus[] = ["publishing", "published"];
const FINISHED: PostStatus[] = ["publishing", "published", "not_published", "failed"];

function statusFor(reviewStatus: ReviewStatus, scheduledAt: Date | null): PostStatus {
  if (reviewStatus === "pending") return "reviewing";
  if (reviewStatus === "needs_adjustment") return "needs_adjustment";
  if (scheduledAt) return "scheduled";
  return reviewStatus === "approved" ? "approved" : "draft";
}

export function initialState(input: {
  scheduledAt: Date | null;
  sendToReview: boolean;
  publishOnlyIfApproved: boolean;
}): PostState {
  const reviewStatus: ReviewStatus = input.sendToReview ? "pending" : "none";
  return {
    status: statusFor(reviewStatus, input.scheduledAt),
    reviewStatus,
    scheduledAt: input.scheduledAt,
    publishOnlyIfApproved: input.publishOnlyIfApproved,
  };
}

export function canEdit(status: PostStatus): boolean {
  return !LOCKED.includes(status);
}

export function afterSendToReview(state: PostState): PostState {
  return { ...state, reviewStatus: "pending", status: "reviewing" };
}

export function afterReview(state: PostState, decision: ReviewDecision): PostState {
  return { ...state, reviewStatus: decision, status: statusFor(decision, state.scheduledAt) };
}

export function afterReviewStatusChange(state: PostState, reviewStatus: ReviewStatus): PostState {
  return { ...state, reviewStatus, status: statusFor(reviewStatus, state.scheduledAt) };
}

export function afterSchedule(state: PostState, scheduledAt: Date): PostState {
  return { ...state, scheduledAt, status: statusFor(state.reviewStatus, scheduledAt) };
}

export function afterCancelSchedule(state: PostState): PostState {
  return { ...state, scheduledAt: null, status: statusFor(state.reviewStatus, null) };
}

/**
 * Status de revisão a partir das decisões válidas: vale a mais recente.
 * Sem decisão válida, continua "pending" se o post foi enviado ao cliente.
 */
export function reviewStatusFromReviews(
  reviews: Array<{ decision: string; invalidatedAt: Date | null; createdAt: Date }>,
  sentForReview: boolean,
): ReviewStatus {
  const latest = reviews
    .filter((review) => !review.invalidatedAt)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (latest?.decision === "approved" || latest?.decision === "needs_adjustment") return latest.decision;
  return sentForReview ? "pending" : "none";
}

export type PublishDecision = "wait" | "publish" | "skip_not_approved";

/** O que o agendador deve fazer com o post agora. */
export function publishDecision(state: PostState, now: Date): PublishDecision {
  if (!state.scheduledAt || state.scheduledAt.getTime() > now.getTime()) return "wait";
  if (FINISHED.includes(state.status) || state.status === "draft") return "wait";
  const approved = state.reviewStatus === "approved" || state.reviewStatus === "none";
  if (state.publishOnlyIfApproved && !approved) return "skip_not_approved";
  return "publish";
}

export type CaptionDecision = ReviewDecision | "edited";

/**
 * Decisão geral do cliente a partir da arte e da legenda. Legenda editada pelo
 * próprio cliente conta como aprovada (ele já deixou do jeito que quer).
 */
export function overallDecision(media: ReviewDecision, caption: CaptionDecision): ReviewDecision {
  return media === "needs_adjustment" || caption === "needs_adjustment" ? "needs_adjustment" : "approved";
}

/** Resultado do post a partir das redes: basta uma falha para marcar "Falha". */
export function finalStatusFromTargets(statuses: string[]): PostStatus {
  if (statuses.length === 0) return "failed";
  return statuses.every((status) => status === "published") ? "published" : "failed";
}
