"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, PenLine, Type } from "lucide-react";
import { submitReview } from "@/lib/autoposter/actions/review";
import { CAPTION_MAX, type PostStatus } from "@/lib/autoposter/constants";
import { isVideoUrl } from "@/lib/autoposter/media";
import { MediaThumb, NetworkStack, StatusPill } from "../../_ui/primitives";

export type ReviewPostDTO = {
  id: string;
  title: string;
  caption: string;
  firstComment: string | null;
  mediaUrls: string[];
  when: string | null;
  formatLabel: string;
  networks: string[];
  username: string;
  status: PostStatus;
  closed: boolean;
  last: { media: string; mediaComment: string | null; caption: string; captionComment: string | null; by: string } | null;
};

type MediaChoice = "approved" | "needs_adjustment";
type CaptionChoice = "approved" | "needs_adjustment" | "edited";
type Draft = { media?: MediaChoice; mediaComment: string; caption?: CaptionChoice; captionComment: string; editedCaption: string };

const EMPTY: Draft = { mediaComment: "", captionComment: "", editedCaption: "" };

function Media({ urls }: { urls: string[] }) {
  const [index, setIndex] = useState(0);
  const url = urls[index];
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-ap-line">
      {url && isVideoUrl(url) ? <video src={url} controls playsInline className="h-full w-full bg-black object-contain" /> : <MediaThumb url={url} className="h-full w-full" />}
      {urls.length > 1 && (
        <>
          <button type="button" aria-label="Mídia anterior" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-white/90 p-1 disabled:opacity-0">
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Próxima mídia"
            disabled={index === urls.length - 1}
            onClick={() => setIndex((i) => i + 1)}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-white/90 p-1 disabled:opacity-0"
          >
            <ChevronRight size={16} aria-hidden />
          </button>
          <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
            {index + 1}/{urls.length}
          </span>
        </>
      )}
    </div>
  );
}

function Choice({ active, tone, onClick, icon, label }: { active: boolean; tone: "green" | "orange" | "blue"; onClick: () => void; icon: React.ReactNode; label: string }) {
  const on = tone === "green" ? "ap-btn-green" : tone === "orange" ? "border-ap-orange bg-ap-orange text-white" : "ap-btn-primary";
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`ap-btn ap-btn-md flex-1 ${active ? on : "ap-btn-tertiary"}`}>
      {icon} {label}
    </button>
  );
}

const isDone = (draft?: Draft) => Boolean(draft?.media && draft.caption);

function lastSummary(last: NonNullable<ReviewPostDTO["last"]>) {
  const media = last.media === "approved" ? "arte aprovada" : `ajuste na arte${last.mediaComment ? ` (“${last.mediaComment}”)` : ""}`;
  const caption =
    last.caption === "approved" ? "legenda aprovada" : last.caption === "edited" ? "legenda editada" : `ajuste na legenda${last.captionComment ? ` (“${last.captionComment}”)` : ""}`;
  return `Última revisão de ${last.by}: ${media}, ${caption}.`;
}

export function ReviewBoard({ token, reviewerToken, posts }: { token: string; reviewerToken: string; posts: ReviewPostDTO[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const open = posts.filter((post) => !post.closed);
  const reviewed = open.filter((post) => isDone(drafts[post.id])).length;

  const patch = (postId: string, change: Partial<Draft>) => setDrafts((all) => ({ ...all, [postId]: { ...(all[postId] ?? EMPTY), ...change } }));

  const send = () => {
    setError(null);
    const items = Object.entries(drafts)
      .filter(([, draft]) => isDone(draft))
      .map(([postId, draft]) => ({
        postId,
        media: draft.media as MediaChoice,
        mediaComment: draft.mediaComment || null,
        caption: draft.caption as CaptionChoice,
        captionComment: draft.captionComment || null,
        editedCaption: draft.caption === "edited" ? draft.editedCaption : null,
      }));
    startTransition(async () => {
      const result = await submitReview(token, reviewerToken, items);
      if (!result.ok) return setError(result.error);
      router.push(`/autoposter/aprovacao/${token}/r/${reviewerToken}/concluido?aprovados=${result.data.approved}&ajustes=${result.data.adjustments}`);
    });
  };

  return (
    <>
      <div className="flex flex-col gap-8 pb-32">
        {posts.map((post) => {
          const draft = drafts[post.id] ?? EMPTY;
          return (
            <article key={post.id} className="grid gap-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ap-line md:grid-cols-[320px_1fr]">
              <Media urls={post.mediaUrls} />
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-2 text-sm text-ap-subtle">
                  <NetworkStack networks={post.networks} max={3} size={22} />
                  <span className="font-semibold text-ap-ink">{post.formatLabel}</span>
                  <span>· @{post.username}</span>
                  {post.when && (
                    <span className="flex items-center gap-1">
                      <CalendarDays size={14} aria-hidden /> {post.when}
                    </span>
                  )}
                </div>
                {post.title && <h2 className="text-lg font-bold text-ap-ink">{post.title}</h2>}
                {post.last && <p className="rounded-lg bg-ap-bg px-3 py-2 text-xs text-ap-subtle">{lastSummary(post.last)}</p>}

                {post.closed ? (
                  <>
                    <p className="max-h-72 overflow-y-auto text-sm whitespace-pre-wrap text-ap-ink">{post.caption}</p>
                    <div className="mt-auto">
                      <StatusPill status={post.status} solid />
                    </div>
                  </>
                ) : (
                  <>
                    <section aria-label="Arte do post" className="flex flex-col gap-3 rounded-xl border border-ap-line p-4">
                      <h3 className="ap-title text-base">1. Arte do post</h3>
                      <div className="flex flex-wrap gap-2">
                        <Choice active={draft.media === "approved"} tone="green" onClick={() => patch(post.id, { media: "approved" })} icon={<Check size={16} aria-hidden />} label="Aprovar arte" />
                        <Choice
                          active={draft.media === "needs_adjustment"}
                          tone="orange"
                          onClick={() => patch(post.id, { media: "needs_adjustment" })}
                          icon={<PenLine size={16} aria-hidden />}
                          label="Pedir ajuste"
                        />
                      </div>
                      {draft.media === "needs_adjustment" && (
                        <label className="ap-field">
                          <span className="ap-field-label">O que precisa mudar na arte?</span>
                          <textarea
                            id={`media-comment-${post.id}`}
                            name={`mediaComment-${post.id}`}
                            className="ap-input"
                            maxLength={1000}
                            value={draft.mediaComment}
                            onChange={(event) => patch(post.id, { mediaComment: event.target.value })}
                            placeholder="Ex.: trocar a foto, aumentar o logo…"
                          />
                        </label>
                      )}
                    </section>

                    <section aria-label="Legenda" className="flex flex-col gap-3 rounded-xl border border-ap-line p-4">
                      <h3 className="ap-title text-base">2. Legenda</h3>
                      {draft.caption === "edited" ? (
                        <label className="ap-field">
                          <span className="ap-field-label">Sua versão da legenda</span>
                          <textarea id={`edited-caption-${post.id}`} name={`editedCaption-${post.id}`} className="ap-input !min-h-[180px]" maxLength={CAPTION_MAX} value={draft.editedCaption} onChange={(event) => patch(post.id, { editedCaption: event.target.value })} />
                          <span className="mt-1 block text-right text-xs text-ap-muted">
                            {draft.editedCaption.length}/{CAPTION_MAX}
                          </span>
                        </label>
                      ) : (
                        <p className="max-h-72 overflow-y-auto rounded-lg bg-ap-bg px-3 py-2 text-sm whitespace-pre-wrap text-ap-ink">
                          {post.caption || <span className="text-ap-muted">Sem legenda.</span>}
                        </p>
                      )}
                      {post.firstComment && <p className="text-xs text-ap-muted">1º comentário: {post.firstComment}</p>}
                      <div className="flex flex-wrap gap-2">
                        <Choice active={draft.caption === "approved"} tone="green" onClick={() => patch(post.id, { caption: "approved" })} icon={<Check size={16} aria-hidden />} label="Aprovar legenda" />
                        <Choice
                          active={draft.caption === "needs_adjustment"}
                          tone="orange"
                          onClick={() => patch(post.id, { caption: "needs_adjustment" })}
                          icon={<PenLine size={16} aria-hidden />}
                          label="Pedir ajuste"
                        />
                        <Choice
                          active={draft.caption === "edited"}
                          tone="blue"
                          onClick={() => patch(post.id, { caption: "edited", editedCaption: draft.editedCaption || post.caption })}
                          icon={<Type size={16} aria-hidden />}
                          label="Editar legenda"
                        />
                      </div>
                      {draft.caption === "needs_adjustment" && (
                        <label className="ap-field">
                          <span className="ap-field-label">O que precisa mudar na legenda?</span>
                          <textarea
                            id={`caption-comment-${post.id}`}
                            name={`captionComment-${post.id}`}
                            className="ap-input"
                            maxLength={1000}
                            value={draft.captionComment}
                            onChange={(event) => patch(post.id, { captionComment: event.target.value })}
                            placeholder="Ex.: corrigir o preço, tirar a hashtag…"
                          />
                        </label>
                      )}
                      {draft.caption === "edited" && <p className="text-xs text-ap-muted">Ao enviar, sua versão substitui a legenda do post. A anterior fica guardada no histórico.</p>}
                    </section>
                  </>
                )}
              </div>
            </article>
          );
        })}
        {posts.length === 0 && <p className="rounded-2xl bg-white p-10 text-center text-ap-muted">Nenhum post neste grupo ainda.</p>}
      </div>

      {open.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ap-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-[960px] flex-wrap items-center justify-between gap-3 px-4 py-4">
            <span className="text-sm text-ap-subtle">
              <strong className="text-ap-ink">{reviewed}</strong> de {open.length} posts revisados (arte e legenda)
            </span>
            {error && (
              <span role="alert" className="text-sm text-ap-red">
                {error}
              </span>
            )}
            <button type="button" className="ap-btn ap-btn-primary" disabled={pending || reviewed === 0} onClick={send}>
              {pending ? "Enviando…" : "Enviar revisão"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
