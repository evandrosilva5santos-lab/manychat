// Converte posts do banco em dados prontos para os cards (serializáveis para o cliente).
import { FORMAT_LABEL, type PostFormat, type PostStatus } from "@/lib/autoposter/constants";
import { formatDateTime, timeInZone, ymdInZone } from "@/lib/autoposter/dates";
import type { PostCardData } from "@/lib/autoposter/queries";

export type CardDTO = {
  id: string;
  title: string;
  status: PostStatus;
  approved: boolean;
  ymd: string | null;
  time: string | null;
  when: string | null;
  networks: string[];
  formatLabel: string;
  thumb: string | null;
  isVideo: boolean;
  categoryColor: string | null;
};

export function toCardDTO(post: PostCardData, timeZone: string, dateFormat: string): CardDTO {
  const formats = [...new Set(post.targets.map((target) => target.format as PostFormat))];
  return {
    id: post.id,
    title: post.title || post.caption.slice(0, 60) || "Post sem legenda",
    status: post.status as PostStatus,
    approved: post.reviewStatus === "approved",
    ymd: post.scheduledAt ? ymdInZone(post.scheduledAt, timeZone) : null,
    time: post.scheduledAt ? timeInZone(post.scheduledAt, timeZone) : null,
    when: post.scheduledAt ? formatDateTime(post.scheduledAt, timeZone, dateFormat) : null,
    networks: post.targets.map((target) => target.network),
    formatLabel: formats.map((format) => FORMAT_LABEL[format] ?? format).join(", ") || "Feed",
    thumb: post.mediaUrls[0] ?? null,
    isVideo: post.mediaType === "VIDEO",
    categoryColor: post.category?.color ?? null,
  };
}
