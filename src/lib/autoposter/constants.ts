// Vocabulário do Autoposter, espelhando o Reportei Flux (ver docs/autoposter/flux-engenharia-reversa.md).

export const POST_STATUSES = [
  "draft",
  "reviewing",
  "needs_adjustment",
  "approved",
  "scheduled",
  "publishing",
  "published",
  "not_published",
  "failed",
] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const REVIEW_STATUSES = ["none", "pending", "approved", "needs_adjustment"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export type ReviewDecision = "approved" | "needs_adjustment";

export const NETWORKS = ["instagram", "facebook"] as const;
export type Network = (typeof NETWORKS)[number];

export const FORMATS = ["feed", "story", "reels"] as const;
export type PostFormat = (typeof FORMATS)[number];

export const MEDIA_TYPES = ["IMAGE", "VIDEO", "CAROUSEL"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export type StatusTone = "neutral" | "warning" | "adjust" | "success" | "info" | "published" | "danger";

export const STATUS_META: Record<PostStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Rascunho", tone: "neutral" },
  reviewing: { label: "Aguardando revisão", tone: "warning" },
  needs_adjustment: { label: "Pedido de ajuste", tone: "adjust" },
  approved: { label: "Aprovado", tone: "success" },
  scheduled: { label: "Agendado", tone: "info" },
  publishing: { label: "Publicando", tone: "info" },
  published: { label: "Publicado", tone: "published" },
  not_published: { label: "Não publicado", tone: "danger" },
  failed: { label: "Falha", tone: "danger" },
};

/** Ordem dos chips de filtro em "Meus posts" (igual ao Flux). */
export const STATUS_FILTERS: Array<{ key: "all" | PostStatus; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "draft", label: "Rascunho" },
  { key: "reviewing", label: "Aguardando revisão" },
  { key: "needs_adjustment", label: "Pedido de ajuste" },
  { key: "approved", label: "Aprovado" },
  { key: "scheduled", label: "Agendado" },
  { key: "published", label: "Publicado" },
  { key: "not_published", label: "Não publicado" },
  { key: "failed", label: "Falha" },
];

export const FORMAT_LABEL: Record<PostFormat, string> = { feed: "Feed", story: "Story", reels: "Reels" };
export const NETWORK_LABEL: Record<Network, string> = { instagram: "Instagram", facebook: "Facebook" };

export const CATEGORY_COLORS = [
  "#A1887F",
  "#EF5350",
  "#FF7043",
  "#FFB74D",
  "#66BB6A",
  "#26C6DA",
  "#29B6F6",
  "#4285F4",
  "#AB47BC",
  "#EC407A",
] as const;

export const TIMEZONES = [
  { id: "America/Sao_Paulo", label: "(UTC-03:00) America, Sao_Paulo" },
  { id: "America/Manaus", label: "(UTC-04:00) America, Manaus" },
  { id: "America/Rio_Branco", label: "(UTC-05:00) America, Rio_Branco" },
  { id: "America/Noronha", label: "(UTC-02:00) America, Noronha" },
  { id: "Europe/Lisbon", label: "(UTC+00:00) Europe, Lisbon" },
] as const;

export const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export const CAPTION_MAX = 2200;
export const MAX_MEDIA = 10;
export const PUBLISH_MAX_ATTEMPTS = 3;
