"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, ExternalLink, Heart, MessageCircle, UserRound } from "lucide-react";
import { AccountAvatar } from "@/components/layout/AccountAvatar";
import { timeAgo } from "@/lib/format";
import { markLikedAction } from "./actions";

export type NotOpenedRow = {
  contactId: string;
  username: string | null;
  name: string | null;
  profilePicUrl: string | null;
  stage: "link" | "gate";
  flowName: string | null;
  since: string;
  commentText: string | null;
  postUrl: string | null;
};

const STAGE_LABEL = {
  link: "Recebeu o link e não abriu",
  gate: "Parou no portão de seguidor",
} as const;

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const ACTION = `inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border-strong bg-surface-200 px-3 text-xs font-semibold text-ink hover:bg-surface-300 ${FOCUS}`;

export function NotOpenedClient({ rows, username, error }: { rows: NotOpenedRow[]; username: string | null; error: string | null }) {
  const [visible, setVisible] = useState(rows);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function markLiked(contactId: string) {
    setPendingId(contactId);
    startTransition(async () => {
      const result = await markLikedAction(contactId);
      setPendingId(null);
      if (result.ok) {
        setVisible((current) => current.filter((row) => row.contactId !== contactId));
        setFeedback(null);
      } else {
        setFeedback(result.error);
      }
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <div>
        <Link href="/contatos" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink">
          <ArrowLeft size={14} aria-hidden /> Contatos
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Não abriram o conteúdo</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Leads dos últimos 7 dias{username ? ` de @${username}` : ""} que não chegaram ao link. Uma curtida feita por você no
          comentário ou numa foto do perfil é um toque humano que costuma trazer a pessoa de volta.
        </p>
        <p className="mt-2 text-xs text-ink-subtle">
          O instachat não curte sozinho: a API do Instagram não permite e curtida automática infringe os Termos de Uso.
        </p>
      </div>

      {(error || feedback) && (
        <p role="alert" className="rounded-md border border-danger bg-danger-soft px-4 py-3 text-sm font-medium text-ink">
          {error ?? feedback}
        </p>
      )}

      {!error && visible.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface-200 p-6 text-sm text-ink-muted">
          Ninguém pendente agora. Quem abrir o link ou receber sua curtida sai desta lista.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((row) => {
            const handle = row.username ? `@${row.username}` : "Contato sem @";
            return (
              <li key={row.contactId} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-200 p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <AccountAvatar username={row.username ?? "?"} profilePicUrl={row.profilePicUrl} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                      <span className="truncate">{handle}</span>
                      <span className="rounded-sm bg-warning-soft px-1.5 py-0.5 text-xs font-semibold text-warning">
                        {STAGE_LABEL[row.stage]}
                      </span>
                    </p>
                    <p className="text-xs text-ink-subtle">
                      {row.flowName ? `${row.flowName} · ` : ""}{timeAgo(new Date(row.since))}
                    </p>
                    {row.commentText && (
                      <p className="mt-2 flex items-start gap-1.5 text-sm text-ink">
                        <MessageCircle size={14} className="mt-0.5 flex-none text-ink-muted" aria-hidden />
                        <span className="line-clamp-2">“{row.commentText}”</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {row.username && (
                    <a href={`https://instagram.com/${encodeURIComponent(row.username)}`} target="_blank" rel="noopener noreferrer" className={ACTION}>
                      <UserRound size={14} aria-hidden /> Abrir perfil <ExternalLink size={12} aria-hidden />
                    </a>
                  )}
                  {row.postUrl && (
                    <a href={row.postUrl} target="_blank" rel="noopener noreferrer" className={ACTION}>
                      <MessageCircle size={14} aria-hidden /> Ver comentário na publicação <ExternalLink size={12} aria-hidden />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => markLiked(row.contactId)}
                    disabled={pendingId === row.contactId}
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-on-primary hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60 ${FOCUS}`}
                  >
                    <Heart size={14} aria-hidden /> {pendingId === row.contactId ? "Marcando…" : "Já curti"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
