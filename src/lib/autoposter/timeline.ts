// Códigos e textos da linha do tempo (padrão do Flux: document_timeline.*). Sem I/O:
// usado no servidor para gravar e no navegador para exibir.
import type { PostStatus } from "./constants";

export type TimelineCode =
  | "post.created"
  | "post.edited"
  | "post.sent_to_review"
  | "post.schedule_updated"
  | "post.schedule_canceled"
  | "post.marked_as"
  | "post.target_published"
  | "post.target_failed"
  | "review.approved"
  | "review.needs_adjustment"
  | "review.invalidated"
  | "review.caption_edited"
  | `post.status_changed.${PostStatus}`;

export type TimelineEntry = {
  code: string;
  actorType: string;
  actorName: string | null;
  actorEmail: string | null;
  network: string | null;
  format: string | null;
  note: string | null;
};

const STATUS_PHRASE: Partial<Record<PostStatus, string>> = {
  scheduled: "agendou o post",
  publishing: "começou a publicar o post",
  published: "publicou o post",
  not_published: "não publicou o post",
  failed: "não conseguiu publicar o post",
  approved: "marcou o post como aprovado",
  draft: "voltou o post para rascunho",
};

/** Frase curta depois do nome de quem agiu ("Ana aprovou o post"). */
export function timelinePhrase(entry: Pick<TimelineEntry, "code" | "note">): string {
  switch (entry.code) {
    case "post.created":
      return "criou o post";
    case "post.edited":
      return "editou o post";
    case "post.sent_to_review":
      return "enviou o post para aprovação";
    case "post.schedule_updated":
      return "alterou a data de publicação";
    case "post.schedule_canceled":
      return "cancelou o agendamento";
    case "post.marked_as":
      return "alterou o status manualmente";
    case "post.target_published":
      return "publicou nesta rede";
    case "post.target_failed":
      return "falhou ao publicar nesta rede";
    case "review.approved":
      return "aprovou o post";
    case "review.needs_adjustment":
      return "pediu ajuste no post";
    case "review.invalidated":
      return "invalidou uma revisão";
    case "review.caption_edited":
      return "editou a legenda";
  }
  const status = entry.code.replace("post.status_changed.", "") as PostStatus;
  return STATUS_PHRASE[status] ?? "atualizou o post";
}

export function actorLabel(entry: Pick<TimelineEntry, "actorType" | "actorName" | "actorEmail">): string {
  if (entry.actorType === "system") return "instachat";
  return entry.actorEmail?.toUpperCase() || entry.actorName || (entry.actorType === "client" ? "Cliente" : "Equipe");
}

/** Tom da pílula de status ao lado do evento. */
export function timelineTone(code: string): "success" | "adjust" | "danger" | "info" | "published" | "neutral" {
  if (code === "review.approved") return "success";
  if (code === "review.needs_adjustment") return "adjust";
  if (code.endsWith(".published") || code === "post.target_published") return "published";
  if (code.endsWith(".failed") || code.endsWith(".not_published") || code === "post.target_failed") return "danger";
  if (code.endsWith(".scheduled") || code === "post.schedule_updated" || code === "review.caption_edited") return "info";
  return "neutral";
}

export const TIMELINE_PILL: Record<string, string> = {
  "review.approved": "Aprovado",
  "review.needs_adjustment": "Pedido de ajuste",
  "review.invalidated": "Invalidado",
  "review.caption_edited": "Legenda editada",
  "post.target_published": "Publicado",
  "post.target_failed": "Falha",
  "post.status_changed.published": "Publicado",
  "post.status_changed.failed": "Falha",
  "post.status_changed.not_published": "Não publicado",
  "post.status_changed.scheduled": "Agendado",
  "post.sent_to_review": "Aguardando revisão",
};
