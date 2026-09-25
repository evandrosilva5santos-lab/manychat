"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Tag as TagIcon,
  MessageSquare,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  X,
  Filter,
  UserCheck,
  UserX,
  Sparkles,
} from "lucide-react";
import {
  addTagToContact,
  removeTagFromContact,
  type ContactListItem,
} from "./actions";

interface ContactsClientProps {
  initialContacts: ContactListItem[];
  availableTags: { id: string; name: string }[];
}

export function ContactsClient({
  initialContacts,
  availableTags,
}: ContactsClientProps) {
  const [contacts, setContacts] = useState<ContactListItem[]>(initialContacts);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("ALL");
  const [followFilter, setFollowFilter] = useState<"ALL" | "FOLLOWING" | "NOT_FOLLOWING">("ALL");
  const [only24h, setOnly24h] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Modal para adicionar etiqueta rápida
  const [tagModalContact, setTagModalContact] = useState<ContactListItem | null>(null);

  // Filtragem
  const filteredContacts = contacts.filter((c) => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchName = c.name?.toLowerCase().includes(q);
      const matchUser = c.username?.toLowerCase().includes(q);
      if (!matchName && !matchUser) return false;
    }
    if (selectedTag !== "ALL") {
      if (!c.tags.some((t) => t.id === selectedTag)) return false;
    }
    if (followFilter === "FOLLOWING" && !c.followsAccount) return false;
    if (followFilter === "NOT_FOLLOWING" && c.followsAccount) return false;
    if (only24h && !c.is24hActive) return false;
    return true;
  });

  // Métricas
  const totalContacts = contacts.length;
  const active24hCount = contacts.filter((c) => c.is24hActive).length;
  const followersCount = contacts.filter((c) => c.followsAccount).length;
  const taggedHotCount = contacts.filter((c) => c.tags.some((t) => t.name.includes("quente"))).length;

  const handleAddTag = (contactId: string, tagId: string) => {
    startTransition(async () => {
      const res = await addTagToContact(contactId, tagId);
      if (res.ok) {
        const tagObj = availableTags.find((t) => t.id === tagId);
        if (tagObj) {
          setContacts((prev) =>
            prev.map((c) =>
              c.id === contactId && !c.tags.some((t) => t.id === tagId)
                ? { ...c, tags: [...c.tags, tagObj] }
                : c
            )
          );
        }
      }
      setTagModalContact(null);
    });
  };

  const handleRemoveTag = (contactId: string, tagId: string) => {
    startTransition(async () => {
      const res = await removeTagFromContact(contactId, tagId);
      if (res.ok) {
        setContacts((prev) =>
          prev.map((c) =>
            c.id === contactId
              ? { ...c, tags: c.tags.filter((t) => t.id !== tagId) }
              : c
          )
        );
      }
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface-100 text-ink">
      {/* Top Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-surface-200/90 backdrop-blur-md px-8 py-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-7xl mx-auto w-full">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users size={20} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-ink">Contatos & Leads</h1>
              <span className="rounded-full bg-accent-muted/20 px-2 py-0.5 text-xs font-semibold text-accent">
                Etapa 6 · CRM Instagram
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              Todos os seguidores e leads capturados por comentários, DMs e fluxos automáticos.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/conversas"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-primary-hover active:scale-[0.98]"
            >
              <MessageSquare size={17} />
              Abrir Bate-Papo (Live Inbox)
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-8 py-8">
        {/* Métricas do Topo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-2xl border border-border bg-surface-200 p-4">
            <span className="text-xs font-medium text-ink-subtle">Total de Contatos</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-ink">{totalContacts}</span>
              <span className="text-xs text-ink-muted">capturados</span>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface-200 p-4">
            <span className="text-xs font-medium text-ink-subtle">Janela 24h Ativa</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-500">{active24hCount}</span>
              <span className="text-xs text-ink-muted">podem receber DM agora</span>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface-200 p-4">
            <span className="text-xs font-medium text-ink-subtle">Seguidores Confirmados</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-primary">{followersCount}</span>
              <span className="text-xs text-ink-muted">seguem seu perfil</span>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface-200 p-4">
            <span className="text-xs font-medium text-ink-subtle">Leads Quentes</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-500">{taggedHotCount}</span>
              <span className="text-xs text-ink-muted">com tag quente</span>
            </div>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <input
              type="text"
              placeholder="Buscar por @username ou nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-200 pl-10 pr-4 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro por Etiqueta */}
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="rounded-xl border border-border bg-surface-200 px-3 py-2 text-xs font-semibold text-ink focus:border-primary focus:outline-none"
            >
              <option value="ALL">Todas as Etiquetas</option>
              {availableTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  🏷️ {tag.name}
                </option>
              ))}
            </select>

            {/* Filtro de Seguidor */}
            <select
              value={followFilter}
              onChange={(e) => setFollowFilter(e.target.value as any)}
              className="rounded-xl border border-border bg-surface-200 px-3 py-2 text-xs font-semibold text-ink focus:border-primary focus:outline-none"
            >
              <option value="ALL">Status de Seguidor</option>
              <option value="FOLLOWING">Apenas quem Segue</option>
              <option value="NOT_FOLLOWING">Não Segue</option>
            </select>

            {/* Botão Janela de 24h */}
            <button
              onClick={() => setOnly24h(!only24h)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                only24h
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                  : "bg-surface-200 border-border text-ink-muted hover:text-ink"
              }`}
            >
              <Clock size={14} />
              <span>Janela 24h</span>
            </button>
          </div>
        </div>

        {/* Tabela de Contatos */}
        <div className="rounded-2xl border border-border bg-surface-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-300/40 text-xs font-semibold text-ink-muted uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-6">Contato</th>
                  <th className="py-3.5 px-4">Etiquetas</th>
                  <th className="py-3.5 px-4">Segue?</th>
                  <th className="py-3.5 px-4">Janela Meta (24h)</th>
                  <th className="py-3.5 px-4">Origem</th>
                  <th className="py-3.5 px-6 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-ink-muted">
                      Nenhum contato encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-surface-300/30 transition">
                      {/* Avatar e Nome */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 flex-none rounded-full overflow-hidden bg-surface-300 border border-border">
                            {contact.profilePicUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={contact.profilePicUrl}
                                alt={contact.username || ""}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center font-bold text-xs text-ink-muted uppercase">
                                {contact.username?.slice(0, 2) || "IG"}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-ink flex items-center gap-1.5">
                              <span>{contact.name || contact.username}</span>
                              {contact.username && (
                                <a
                                  href={`https://instagram.com/${contact.username}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-ink-subtle hover:text-primary transition"
                                  title="Ver no Instagram"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                            <span className="text-xs text-ink-muted">@{contact.username || "sem_user"}</span>
                          </div>
                        </div>
                      </td>

                      {/* Etiquetas com atalho para adicionar */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                          {contact.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="group flex items-center gap-1 rounded-md bg-surface-300 px-2 py-0.5 text-[11px] font-semibold text-ink border border-border"
                            >
                              <span>{tag.name}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveTag(contact.id, tag.id)}
                                className="text-ink-subtle hover:text-danger opacity-0 group-hover:opacity-100 transition"
                                title="Remover etiqueta"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                          <button
                            type="button"
                            onClick={() => setTagModalContact(contact)}
                            className="flex h-5 w-5 items-center justify-center rounded-md border border-dashed border-ink-subtle/50 text-ink-subtle hover:border-primary hover:text-primary transition"
                            title="Adicionar etiqueta"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      </td>

                      {/* Status de Seguidor */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {contact.followsAccount ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500">
                            <UserCheck size={12} /> Segue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface-300 px-2.5 py-0.5 text-xs font-semibold text-ink-muted">
                            <UserX size={12} /> Não segue
                          </span>
                        )}
                      </td>

                      {/* Janela de 24 horas da Meta */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {contact.is24hActive ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>Aberta ({contact.remainingHours24h}h restantes)</span>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-subtle flex items-center gap-1">
                            <Clock size={12} /> Expirada
                          </span>
                        )}
                      </td>

                      {/* Origem / Fluxo */}
                      <td className="py-4 px-4 whitespace-nowrap text-xs text-ink-muted">
                        {contact.sourceFlowName || "Direto"}
                      </td>

                      {/* Botão de Bate-Papo */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <Link
                          href={`/conversas?contactId=${contact.id}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-300 px-3 py-1.5 text-xs font-bold text-ink hover:bg-primary hover:text-white hover:border-primary transition"
                        >
                          <MessageSquare size={13} />
                          <span>Bate-Papo</span>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal Rápido para Adicionar Etiqueta */}
      {tagModalContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface-200 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <TagIcon size={16} className="text-primary" />
                <h3 className="font-bold text-sm text-ink">Adicionar Etiqueta</h3>
              </div>
              <button
                onClick={() => setTagModalContact(null)}
                className="text-ink-muted hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            <p className="mt-2 text-xs text-ink-muted">
              Selecione uma etiqueta para vincular ao contato{" "}
              <strong>@{tagModalContact.username}</strong>:
            </p>

            <div className="mt-4 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
              {availableTags.map((tag) => {
                const alreadyHas = tagModalContact.tags.some((t) => t.id === tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    disabled={alreadyHas || isPending}
                    onClick={() => handleAddTag(tagModalContact.id, tag.id)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-left transition ${
                      alreadyHas
                        ? "bg-surface-300/50 text-ink-subtle cursor-not-allowed"
                        : "bg-surface-300 text-ink hover:bg-primary hover:text-white"
                    }`}
                  >
                    <span>{tag.name}</span>
                    {alreadyHas && <span className="text-[10px]">Já aplicada</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
