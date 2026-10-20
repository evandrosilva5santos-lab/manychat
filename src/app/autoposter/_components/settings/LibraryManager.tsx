"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Check, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { deleteLibraryItem, saveCategory, saveHashtagGroup, saveSignature } from "@/lib/autoposter/actions/library";
import { CATEGORY_COLORS } from "@/lib/autoposter/constants";
import { Modal } from "../../_ui/Modal";

export type LibraryKind = "hashtag" | "signature" | "category";
export type LibraryItem = { id: string; name: string; value: string };

type Copy = { title: string; create: string; modal: string; search: string; nameLabel: string; column: string; empty: string; valueLabel: string; hint?: string };

const COPY: Record<LibraryKind, Copy> = {
  hashtag: {
    title: "Hashtags do projeto",
    create: "Criar novo grupo",
    modal: "Criar novo grupo de Hashtags",
    search: "Buscar grupos de hashtags...",
    nameLabel: "Nome do grupo",
    column: "Hashtags",
    empty: "Nenhum grupo de hashtags encontrado",
    valueLabel: "Hashtags",
    hint: "Separe as hashtags por vírgula e utilize o símbolo #.",
  },
  signature: {
    title: "Assinaturas do projeto",
    create: "Criar nova assinatura",
    modal: "Criar assinatura",
    search: "Buscar assinaturas...",
    nameLabel: "Nome da assinatura",
    column: "Conteúdo",
    empty: "Nenhuma assinatura encontrada",
    valueLabel: "Conteúdo",
    hint: "Texto adicionado ao fim da legenda (ex.: endereço, WhatsApp, chamada).",
  },
  category: {
    title: "Categorias do projeto",
    create: "Criar nova categoria",
    modal: "Criar categoria",
    search: "Buscar categoria...",
    nameLabel: "Nome da categoria",
    column: "",
    empty: "Nenhuma categoria encontrada",
    valueLabel: "Cor",
  },
};

export function LibraryManager({ projectId, kind, items }: { projectId: string; kind: LibraryKind; items: LibraryItem[] }) {
  const router = useRouter();
  const copy = COPY[kind];
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ id: string | null; name: string; value: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => items.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase())), [items, query]);

  const save = () =>
    startTransition(async () => {
      if (!editing) return;
      const action = kind === "hashtag" ? saveHashtagGroup : kind === "signature" ? saveSignature : saveCategory;
      const result = await action(projectId, editing.id, editing.name, editing.value);
      if (!result.ok) return setError(result.error);
      setEditing(null);
      setError(null);
      router.refresh();
    });

  const remove = (id: string) =>
    startTransition(async () => {
      const result = await deleteLibraryItem(projectId, kind, id);
      if (!result.ok) return setError(result.error);
      router.refresh();
    });

  return (
    <div>
      <h2 className="ap-title text-2xl">{copy.title}</h2>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="relative min-w-60 flex-1">
          <span className="sr-only">{copy.search}</span>
          <Search size={16} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ap-muted" aria-hidden />
          <input id={`${kind}-search`} name={`${kind}Search`} className="ap-search" placeholder={copy.search} value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button type="button" className="ap-btn ap-btn-primary" onClick={() => setEditing({ id: null, name: "", value: kind === "category" ? CATEGORY_COLORS[4] : "" })}>
          <Plus size={18} aria-hidden /> {copy.create}
        </button>
      </div>

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-ap-line text-xs text-ap-subtle">
            <th className="py-3 font-semibold">{copy.nameLabel}</th>
            {copy.column && <th className="py-3 font-semibold">{copy.column}</th>}
            <th className="py-3">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={3} className="py-8 text-center text-base text-ap-muted">
                {copy.empty}
              </td>
            </tr>
          )}
          {visible.map((item) => (
            <tr key={item.id} className="border-b border-ap-line text-ap-ink">
              <td className="py-3 pr-4">
                <span className="flex items-center gap-2">
                  {kind === "category" && <span className="h-3 w-3 rounded-full" style={{ background: item.value }} aria-hidden />}
                  {item.name}
                </span>
              </td>
              {copy.column && <td className="max-w-[420px] truncate py-3 pr-4 text-ap-subtle">{item.value}</td>}
              <td className="py-3">
                <span className="flex justify-end gap-3 text-ap-subtle">
                  <button type="button" aria-label={`Editar ${item.name}`} onClick={() => setEditing({ id: item.id, name: item.name, value: item.value })} className="hover:text-ap-title">
                    <Pencil size={16} aria-hidden />
                  </button>
                  <button type="button" aria-label={`Excluir ${item.name}`} disabled={pending} onClick={() => remove(item.id)} className="hover:text-ap-red">
                    <Trash2 size={16} aria-hidden />
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && !editing && <p role="alert" className="mt-3 text-sm text-ap-red">{error}</p>}

      {editing && (
        <Modal
          title={editing.id ? "Editar" : copy.modal}
          onClose={() => setEditing(null)}
          width="sm"
          footer={
            <>
              <button type="button" className="ap-btn ap-btn-outline" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button type="button" className="ap-btn ap-btn-primary" disabled={pending || !editing.name.trim() || !editing.value.trim()} onClick={save}>
                Salvar
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-5 pt-2">
            <label className="ap-field">
              <span className="ap-field-label">{copy.nameLabel}</span>
              <input id={`${kind}-name`} name={`${kind}Name`} className="ap-input" maxLength={80} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
            </label>
            {kind === "category" ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-ap-ink">Cor:</span>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Cor ${color}`}
                      aria-pressed={editing.value === color}
                      onClick={() => setEditing({ ...editing, value: color })}
                      className="flex h-5 w-5 items-center justify-center rounded text-white"
                      style={{ background: color }}
                    >
                      {editing.value === color && <Check size={12} strokeWidth={3} aria-hidden />}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="ap-field">
                  <span className="ap-field-label">{copy.valueLabel}</span>
                  <textarea id={`${kind}-value`} name={`${kind}Value`} className="ap-input" maxLength={2000} value={editing.value} onChange={(event) => setEditing({ ...editing, value: event.target.value })} />
                </label>
                {copy.hint && <p className="mt-1.5 text-xs text-ap-muted">{copy.hint}</p>}
              </div>
            )}
            {error && <p role="alert" className="text-sm text-ap-red">{error}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
