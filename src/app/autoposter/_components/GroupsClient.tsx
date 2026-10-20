"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ExternalLink, Link2, Plus, Search, Trash2 } from "lucide-react";
import { createReviewGroup, deleteReviewGroup } from "@/lib/autoposter/actions/groups";
import type { PostStatus } from "@/lib/autoposter/constants";
import { Modal } from "../_ui/Modal";
import { EmptyState, MediaThumb, StatusPill } from "../_ui/primitives";

export type GroupDTO = {
  id: string;
  name: string;
  token: string;
  createdAt: string;
  updatedAt: string;
  count: number;
  covers: string[];
  statuses: Partial<Record<PostStatus, number>>;
};

const STATUS_ORDER: PostStatus[] = ["published", "scheduled", "approved", "reviewing", "needs_adjustment", "not_published", "failed", "draft"];

function Mosaic({ covers }: { covers: string[] }) {
  return (
    <div className="flex h-[200px] w-[200px] flex-col gap-1 rounded-[12px] bg-white p-2 shadow-sm ring-1 ring-ap-line">
      <MediaThumb url={covers[0]} className="h-[124px] w-full rounded-md" />
      <div className="grid flex-1 grid-cols-3 gap-1">
        {[1, 2, 3].map((index) => (
          <MediaThumb key={index} url={covers[index]} className="h-full w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}

export function GroupsClient({ projectId, groups }: { projectId: string; groups: GroupDTO[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const copy = async (group: GroupDTO) => {
    await navigator.clipboard.writeText(`${window.location.origin}/autoposter/aprovacao/${group.token}`);
    setCopied(group.id);
  };

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return groups.filter((group) => (!term || group.name.toLowerCase().includes(term)) && (!statusFilter || (group.statuses[statusFilter as PostStatus] ?? 0) > 0));
  }, [groups, query, statusFilter]);

  const create = () =>
    startTransition(async () => {
      const result = await createReviewGroup(projectId, name);
      if (!result.ok) return setError(result.error);
      setCreating(false);
      setName("");
      router.refresh();
    });

  const remove = (id: string) =>
    startTransition(async () => {
      const result = await deleteReviewGroup(id);
      if (!result.ok) return setError(result.error);
      setConfirmId(null);
      router.refresh();
    });

  return (
    <section className="rounded-[12px] bg-white px-4 py-6 md:px-10">
      <div className="flex items-center justify-between gap-3">
        <h2 className="ap-title text-2xl">Grupos de aprovação</h2>
        <button type="button" className="ap-btn ap-btn-tertiary ap-btn-md" onClick={() => setCreating(true)}>
          <Plus size={16} aria-hidden /> Criar novo grupo
        </button>
      </div>

      {groups.length === 0 ? (
        <EmptyState title="Nenhum grupo ainda. Crie um grupo e envie o link para o cliente aprovar os posts." />
      ) : (
        <div className="mt-6 flex gap-6 overflow-x-auto pb-2">
          {groups.slice(0, 6).map((group) => (
            <a key={group.id} href={`/autoposter/aprovacao/${group.token}`} target="_blank" rel="noopener noreferrer" className="shrink-0" title="Ver como o cliente">
              <Mosaic covers={group.covers} />
              <p className="mt-3 flex max-w-[200px] items-center gap-2 px-2">
                <span className="truncate text-base font-bold text-black">{group.name}</span>
                <span className="rounded-full bg-ap-line px-2 text-xs font-semibold text-ap-subtle">{group.count}</span>
              </p>
              <p className="px-2 text-sm text-ap-muted">{group.createdAt}</p>
            </a>
          ))}
        </div>
      )}

      <div className="mt-12 flex flex-wrap items-center justify-between gap-3">
        <h3 className="ap-title text-2xl">Todos os grupos</h3>
        <div className="flex flex-wrap items-center gap-3">
          <label className="ap-field">
            <span className="ap-field-label">Status</span>
            <select className="ap-input !min-h-9 w-44 !py-1 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Todos</option>
              <option value="reviewing">Aguardando revisão</option>
              <option value="needs_adjustment">Pedido de ajuste</option>
              <option value="approved">Aprovado</option>
              <option value="scheduled">Agendado</option>
              <option value="published">Publicado</option>
              <option value="not_published">Não publicado</option>
            </select>
          </label>
          <label className="relative w-72">
            <span className="sr-only">Buscar grupo</span>
            <Search size={16} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ap-muted" aria-hidden />
            <input className="ap-search" placeholder="Buscar grupo..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-ap-line text-sm text-ap-subtle">
              <th className="px-4 py-3 font-semibold">Nome do grupo</th>
              <th className="px-4 py-3 font-semibold">Conteúdo</th>
              <th className="px-4 py-3 font-semibold">Última atualização</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((group) => (
              <tr key={group.id} className="border-b border-ap-line align-top text-sm text-ap-ink">
                <td className="px-4 py-3">{group.name}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center">
                    {group.covers.slice(0, 8).map((cover, index) => (
                      <MediaThumb key={index} url={cover} className="-ml-1.5 h-7 w-7 rounded-full ring-2 ring-white first:ml-0" />
                    ))}
                    {group.count > 8 && (
                      <span className="-ml-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ap-line text-xs font-semibold text-ap-subtle ring-2 ring-white">+{group.count - 8}</span>
                    )}
                    {group.count === 0 && <span className="text-ap-muted">Sem posts</span>}
                  </span>
                </td>
                <td className="px-4 py-3 text-ap-subtle">{group.updatedAt}</td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1.5">
                    {STATUS_ORDER.filter((status) => group.statuses[status]).map((status) => (
                      <StatusPill key={status} status={status} count={group.statuses[status]} solid />
                    ))}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center justify-end gap-3 text-ap-subtle">
                    <button type="button" onClick={() => copy(group)} className="hover:text-ap-title" aria-label="Copiar link de aprovação">
                      <Link2 size={18} aria-hidden />
                    </button>
                    <a href={`/autoposter/aprovacao/${group.token}`} target="_blank" rel="noopener noreferrer" className="hover:text-ap-title" aria-label="Ver como o cliente">
                      <ExternalLink size={16} aria-hidden />
                    </a>
                    <button type="button" onClick={() => setConfirmId(group.id)} className="hover:text-ap-red" aria-label="Excluir grupo">
                      <Trash2 size={18} aria-hidden />
                    </button>
                  </span>
                  {copied === group.id && <span className="mt-1 block text-right text-xs text-ap-green">Link copiado</span>}
                  {confirmId === group.id && (
                    <span className="mt-2 flex flex-wrap items-center justify-end gap-2 text-xs text-ap-red">
                      Excluir o grupo? Os posts continuam no projeto.
                      <button type="button" className="ap-btn ap-btn-danger ap-btn-sm" disabled={pending} onClick={() => remove(group.id)}>
                        Excluir
                      </button>
                      <button type="button" className="ap-btn ap-btn-tertiary ap-btn-sm" onClick={() => setConfirmId(null)}>
                        Manter
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-ap-red">{error}</p>}

      {creating && (
        <Modal
          title="Criar grupo de aprovação"
          onClose={() => setCreating(false)}
          width="sm"
          footer={
            <>
              <button type="button" className="ap-btn ap-btn-outline" onClick={() => setCreating(false)}>
                Cancelar
              </button>
              <button type="button" className="ap-btn ap-btn-primary" disabled={pending || !name.trim()} onClick={create}>
                Salvar
              </button>
            </>
          }
        >
          <label className="ap-field mt-2">
            <span className="ap-field-label">Nome do grupo</span>
            <input className="ap-input" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Posts de novembro" />
          </label>
        </Modal>
      )}
    </section>
  );
}
