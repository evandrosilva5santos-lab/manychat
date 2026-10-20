"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, ChevronLeft, ChevronRight, ExternalLink, FolderOpen, Pencil } from "lucide-react";
import { FORMAT_LABEL, type PostFormat } from "@/lib/autoposter/constants";
import { loadPostDetail, type PostDetailDTO } from "@/lib/autoposter/actions/detail";
import { movePostToGroup } from "@/lib/autoposter/actions/posts";
import { isVideoUrl } from "@/lib/autoposter/media";
import { Modal } from "../_ui/Modal";
import { Avatar, MediaThumb, NetworkBadge, NetworkStack } from "../_ui/primitives";
import { PostActions } from "./PostActions";
import { PostTimeline } from "./PostTimeline";

function Preview({ post, username, avatar }: { post: PostDetailDTO; username: string; avatar: string | null }) {
  const [index, setIndex] = useState(0);
  const url = post.mediaUrls[index];
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-ap-line">
      <div className="mb-3 flex items-center gap-2">
        <Avatar src={avatar} name={username} size={32} />
        <span className="text-sm font-semibold text-ap-ink">@{username}</span>
      </div>
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-ap-line">
        {url && isVideoUrl(url) ? (
          <video src={url} controls playsInline className="h-full w-full bg-black object-contain" />
        ) : (
          <MediaThumb url={url} className="h-full w-full" />
        )}
        {post.mediaUrls.length > 1 && (
          <>
            <button type="button" aria-label="Mídia anterior" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-white/90 p-1 disabled:opacity-0">
              <ChevronLeft size={16} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Próxima mídia"
              disabled={index === post.mediaUrls.length - 1}
              onClick={() => setIndex((i) => i + 1)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-white/90 p-1 disabled:opacity-0"
            >
              <ChevronRight size={16} aria-hidden />
            </button>
            <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
              {index + 1}/{post.mediaUrls.length}
            </span>
          </>
        )}
      </div>
      {post.caption && (
        <p className="mt-3 text-sm whitespace-pre-wrap text-ap-ink">
          <strong className="mr-1">{username}</strong>
          {post.caption}
        </p>
      )}
      {post.firstComment && <p className="mt-2 text-xs text-ap-muted">1º comentário: {post.firstComment}</p>}
    </div>
  );
}

const TABS = [
  ["actions", "Ações pendentes"],
  ["history", "Histórico"],
] as const;

export function PostDetailModal({ postId, onClose }: { postId: string; onClose: () => void }) {
  const router = useRouter();
  const [post, setPost] = useState<PostDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"actions" | "history">("actions");
  const [moving, startMove] = useTransition();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadPostDetail(postId).then((result) => {
      if (cancelled) return;
      if (result.ok) setPost(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [postId, version]);

  const changed = useCallback(() => {
    setVersion((current) => current + 1);
    router.refresh();
  }, [router]);

  const first = post?.targets[0];

  const footer = post && (
    <>
      <label className="relative flex items-center gap-2 rounded-xl border-2 border-ap-line px-3 py-1.5 text-sm text-ap-subtle">
        <FolderOpen size={16} aria-hidden />
        <span className="sr-only">Grupo de aprovação</span>
        <select
          className="bg-transparent pr-2 text-ap-ink outline-none"
          value={post.reviewGroup?.id ?? ""}
          disabled={moving}
          onChange={(event) =>
            startMove(async () => {
              const result = await movePostToGroup(post.id, event.target.value || null);
              if (!result.ok) setError(result.error);
              changed();
            })
          }
        >
          <option value="">Sem grupo de aprovação</option>
          {post.groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>
      {post.editable && (
        <Link href={`/autoposter/projeto/${post.projectId}/post/${post.id}/editar`} className="ap-btn ap-btn-tertiary">
          <Pencil size={16} aria-hidden /> Editar
        </Link>
      )}
    </>
  );

  return (
    <Modal title="Detalhes do post" onClose={onClose} width="xl" footer={footer}>
      {!post && !error && <div className="ap-skeleton h-80 rounded-xl" aria-label="Carregando" />}
      {error && <p role="alert" className="rounded-lg bg-ap-red-soft px-3 py-2 text-sm text-ap-red">{error}</p>}
      {post && first && (
        <div className="flex flex-col gap-6">
          <div className="flex gap-3 overflow-x-auto pb-1">
            <span className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2.5 shadow-[0_1px_2px_rgb(0_68_157/0.08)] ring-1 ring-ap-line">
              <span className="text-base text-ap-ink">Todos</span>
              <NetworkStack networks={post.targets.map((target) => target.network)} max={3} size={18} />
            </span>
            {post.targets.map((target) => (
              <span key={target.id} className="relative flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs text-ap-muted">
                <MediaThumb url={post.mediaUrls[0]} className="h-9 w-7 rounded" />
                <span className="flex flex-col">
                  <span className="flex items-center gap-1 font-semibold">
                    <NetworkBadge network={target.network} size={14} /> {FORMAT_LABEL[target.format as PostFormat] ?? target.format}
                  </span>
                  <span className="max-w-[110px] truncate">{target.username}</span>
                </span>
                {(target.status === "published" || post.reviewStatus === "approved") && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-ap-green text-white">
                    <Check size={10} strokeWidth={3} aria-hidden />
                  </span>
                )}
                {target.permalink && (
                  <a href={target.permalink} target="_blank" rel="noopener noreferrer" className="text-ap-title" aria-label="Abrir no Instagram">
                    <ExternalLink size={12} aria-hidden />
                  </a>
                )}
              </span>
            ))}
          </div>

          <div className="grid gap-8 md:grid-cols-[332px_1fr]">
            <Preview post={post} username={first.username} avatar={first.profilePicUrl} />
            <div>
              <div role="tablist" className="mb-5 flex gap-6 border-b border-ap-line">
                {TABS.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={`-mb-px border-b-[3px] px-2 pb-2 text-base font-bold ${tab === key ? "border-ap-title text-ap-title" : "border-transparent text-ap-muted hover:text-ap-ink"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {tab === "actions" ? <PostActions post={post} onChanged={changed} onClosed={onClose} /> : <PostTimeline timeline={post.timeline} onChanged={changed} />}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
