"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CalendarDays, ChevronDown, Copy, Flag, Pencil, Send, Trash2, X } from "lucide-react";
import type { PostDetailDTO } from "@/lib/autoposter/actions/detail";
import { cancelPostSchedule, deletePost, markPostAs, publishPostNow, reschedulePost, sendPostToReview } from "@/lib/autoposter/actions/posts";
import type { ActionResult } from "@/lib/autoposter/actions/shared";
import { NetworkStack, StatusPill } from "../_ui/primitives";

type Notice = { tone: "green" | "yellow" | "orange" | "blue" | "purple" | "red" | "gray"; text: React.ReactNode };

const NOTICE_CLASS: Record<Notice["tone"], string> = {
  green: "bg-ap-green-soft text-ap-green",
  yellow: "bg-ap-yellow-soft text-ap-yellow",
  orange: "bg-ap-orange-soft text-ap-orange",
  blue: "bg-ap-blue-soft text-ap-title",
  purple: "bg-ap-purple-soft text-ap-purple",
  red: "bg-ap-red-soft text-ap-red",
  gray: "bg-ap-line text-ap-subtle",
};

function noticeFor(post: PostDetailDTO): Notice {
  const failure = post.targets.find((target) => target.failureReason)?.failureReason;
  switch (post.status) {
    case "scheduled":
      return post.reviewStatus === "approved"
        ? { tone: "green", text: <>Estes posts estão aprovados e <strong>serão publicados</strong> na data do agendamento se continuarem como aprovados.</> }
        : { tone: "blue", text: <>Este post <strong>será publicado</strong> na data do agendamento.</> };
    case "approved":
      return { tone: "green", text: <>Post aprovado pelo cliente. Escolha a data para agendar.</> };
    case "reviewing":
      return {
        tone: "yellow",
        text:
          post.publishOnlyIfApproved && post.when ? (
            <>Aguardando aprovação do cliente. Se não for aprovado até a data, <strong>não será publicado</strong>.</>
          ) : (
            <>Aguardando aprovação do cliente.</>
          ),
      };
    case "needs_adjustment":
      return { tone: "orange", text: <>O cliente <strong>pediu ajuste</strong>. Edite o post e envie para aprovação de novo.</> };
    case "published":
      return { tone: "purple", text: <>Post <strong>publicado</strong>.</> };
    case "publishing":
      return { tone: "blue", text: <>Publicando agora…</> };
    case "not_published":
      return { tone: "orange", text: <>O post <strong>não foi publicado</strong> porque não foi aprovado a tempo. Reagende para tentar de novo.</> };
    case "failed":
      return { tone: "red", text: <>Falha ao publicar: {failure ?? "erro desconhecido"}</> };
    default:
      return { tone: "gray", text: <>Rascunho: agende ou envie para aprovação.</> };
  }
}

const MARK_OPTIONS = [
  ["published", "Publicado"],
  ["not_published", "Não publicado"],
  ["draft", "Rascunho"],
] as const;

export function PostActions({ post, onChanged, onClosed }: { post: PostDetailDTO; onChanged: () => void; onClosed: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState(false);
  const [date, setDate] = useState(post.scheduleDate ?? "");
  const [time, setTime] = useState(post.scheduleTime ?? "09:00");
  const [menuOpen, setMenuOpen] = useState(false);
  const [markOpen, setMarkOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const notice = noticeFor(post);
  const networks = post.targets.map((target) => target.network);

  const run = (action: () => Promise<ActionResult<unknown>>, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      setInfo(null);
      const result = await action();
      if (!result.ok) return setError(result.error);
      if (result.message) setInfo(result.message);
      setMenuOpen(false);
      setMarkOpen(false);
      after?.();
      onChanged();
    });

  const copyLink = async () => {
    if (!post.reviewGroup) return;
    await navigator.clipboard.writeText(`${window.location.origin}/autoposter/aprovacao/${post.reviewGroup.token}`);
    setInfo("Link de aprovação copiado.");
  };

  return (
    <div className="rounded-xl bg-ap-blue-soft/60 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ap-subtle">
        <NetworkStack networks={networks} max={3} size={26} />
        <CalendarDays size={14} aria-hidden />
        {post.when ? (
          <span>
            Agendado para: <strong className="text-ap-ink">{post.when}</strong>
          </span>
        ) : (
          <span>Sem data</span>
        )}
        <span className="ml-auto">
          <StatusPill status={post.status} />
        </span>
      </div>

      <p className={`mt-3 rounded-lg px-3 py-2.5 text-xs ${NOTICE_CLASS[notice.tone]}`}>{notice.text}</p>

      {post.reviewGroup && ["reviewing", "needs_adjustment"].includes(post.status) && (
        <button type="button" onClick={copyLink} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-ap-title hover:underline">
          <Copy size={12} aria-hidden /> Copiar link de aprovação ({post.reviewGroup.name})
        </button>
      )}

      {editingDate && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="ap-field">
            <span className="ap-field-label">Data</span>
            <input type="date" className="ap-input !min-h-9" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="ap-field">
            <span className="ap-field-label">Hora</span>
            <input type="time" className="ap-input !min-h-9" value={time} onChange={(event) => setTime(event.target.value)} />
          </label>
          <button
            type="button"
            className="ap-btn ap-btn-primary ap-btn-md"
            disabled={pending || !date || !time}
            onClick={() => run(() => reschedulePost(post.id, { date, time }), () => setEditingDate(false))}
          >
            Salvar data
          </button>
          <button type="button" className="ap-btn ap-btn-tertiary ap-btn-md" onClick={() => setEditingDate(false)}>
            Cancelar
          </button>
        </div>
      )}

      {post.editable && (
        <div className="relative mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="ap-btn ap-btn-tertiary ap-btn-sm" onClick={() => setEditingDate((open) => !open)}>
            Alterar data/hora
          </button>
          {post.status !== "reviewing" && (
            <button type="button" className="ap-btn ap-btn-tertiary ap-btn-sm" disabled={pending} onClick={() => run(() => sendPostToReview(post.id))}>
              <Send size={12} aria-hidden /> Enviar para aprovação
            </button>
          )}
          <button
            type="button"
            className="ap-btn ap-btn-tertiary ap-btn-sm ml-auto !border-ap-primary !text-ap-title"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            Outras ações <ChevronDown size={14} aria-hidden />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute top-9 right-0 z-20 w-60 rounded-xl bg-white py-2 shadow-lg ring-1 ring-ap-line">
              <button type="button" role="menuitem" className="flex w-full items-center gap-3 px-4 py-2 text-sm text-ap-ink hover:bg-ap-bg" onClick={() => setMarkOpen((open) => !open)}>
                <Flag size={16} className="text-ap-subtle" aria-hidden /> Marcar como
              </button>
              {markOpen && (
                <div className="ml-11 flex flex-col border-l border-ap-line pl-2">
                  {MARK_OPTIONS.map(([value, label]) => (
                    <button key={value} type="button" className="px-2 py-1.5 text-left text-sm text-ap-subtle hover:text-ap-ink" onClick={() => run(() => markPostAs(post.id, value))}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <button type="button" role="menuitem" className="flex w-full items-center gap-3 px-4 py-2 text-sm text-ap-ink hover:bg-ap-bg" disabled={pending} onClick={() => run(() => publishPostNow(post.id))}>
                <Send size={16} className="text-ap-subtle" aria-hidden /> Publicar agora
              </button>
              {post.when && (
                <button type="button" role="menuitem" className="flex w-full items-center gap-3 px-4 py-2 text-sm text-ap-ink hover:bg-ap-bg" onClick={() => run(() => cancelPostSchedule(post.id))}>
                  <X size={16} className="text-ap-subtle" aria-hidden /> Cancelar agendamento
                </button>
              )}
              <Link role="menuitem" href={`/autoposter/projeto/${post.projectId}/post/${post.id}/editar`} className="flex w-full items-center gap-3 px-4 py-2 text-sm text-ap-ink hover:bg-ap-bg">
                <Pencil size={16} className="text-ap-subtle" aria-hidden /> Editar
              </Link>
              <button type="button" role="menuitem" className="flex w-full items-center gap-3 px-4 py-2 text-sm text-ap-red hover:bg-ap-bg" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={16} aria-hidden /> Excluir
              </button>
            </div>
          )}
        </div>
      )}

      {confirmDelete && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-ap-red-soft px-3 py-2 text-sm text-ap-red">
          Excluir este post? Isso não pode ser desfeito.
          <button type="button" className="ap-btn ap-btn-danger ap-btn-sm ml-auto" disabled={pending} onClick={() => run(() => deletePost(post.id), onClosed)}>
            Excluir
          </button>
          <button type="button" className="ap-btn ap-btn-tertiary ap-btn-sm" onClick={() => setConfirmDelete(false)}>
            Manter
          </button>
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-lg bg-ap-red-soft px-3 py-2 text-xs text-ap-red">{error}</p>}
      {info && <p role="status" className="mt-3 rounded-lg bg-ap-green-soft px-3 py-2 text-xs text-ap-green">{info}</p>}
    </div>
  );
}
