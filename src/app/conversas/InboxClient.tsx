"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Search,
  Clock,
  Send,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Tag as TagIcon,
  Plus,
  X,
  UserCheck,
  UserX,
  Layers,
  ArrowRight,
  Info,
  ShieldAlert,
} from "lucide-react";
import {
  sendManualDirectMessage,
  getConversationThread,
  type ConversationSummary,
  type MessageItem,
} from "./actions";
import {
  addTagToContact,
  removeTagFromContact,
  type ContactListItem,
} from "@/app/contatos/actions";

interface InboxClientProps {
  initialConversations: ConversationSummary[];
  initialActiveContactId: string | null;
  initialThread: MessageItem[];
  availableTags: { id: string; name: string }[];
}

export function InboxClient({
  initialConversations,
  initialActiveContactId,
  initialThread,
  availableTags,
}: InboxClientProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>(initialConversations);
  const [activeContactId, setActiveContactId] = useState<string | null>(initialActiveContactId);
  const [thread, setThread] = useState<MessageItem[]>(initialThread);
  const [searchTerm, setSearchTerm] = useState("");
  const [tabFilter, setTabFilter] = useState<"ALL" | "ACTIVE24H">("ALL");
  const [inputText, setInputText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Drawer lateral do contato ativo
  const [showLeadDetails, setShowLeadDetails] = useState(true);
  const [tagModalOpen, setTagModalOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Contato selecionado
  const activeConversation = conversations.find((c) => c.contact.id === activeContactId) || conversations[0];
  const activeContact = activeConversation?.contact;

  // Rola até o final das mensagens ao carregar ou receber nova
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread, activeContactId]);

  // Troca de conversa
  const handleSelectContact = (contactId: string) => {
    if (contactId === activeContactId) return;
    setActiveContactId(contactId);
    setSendError(null);

    startTransition(async () => {
      const messages = await getConversationThread(contactId);
      setThread(messages);
    });
  };

  // Envio de mensagem manual
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeContact) return;
    setSendError(null);

    const messageText = inputText.trim();
    setInputText("");

    startTransition(async () => {
      const res = await sendManualDirectMessage(activeContact.id, messageText);
      if (res.ok) {
        setThread((prev) => [...prev, res.message]);
        // Atualiza preview na listagem
        setConversations((prev) =>
          prev.map((c) =>
            c.contact.id === activeContact.id
              ? {
                  ...c,
                  lastMessage: {
                    text: messageText,
                    direction: "OUT",
                    kind: "TEXT",
                    createdAt: res.message.createdAt,
                  },
                }
              : c
          )
        );
      } else {
        setSendError(res.error);
      }
    });
  };

  // Adição e remoção de etiquetas
  const handleAddTag = (tagId: string) => {
    if (!activeContact) return;
    startTransition(async () => {
      const res = await addTagToContact(activeContact.id, tagId);
      if (res.ok) {
        const tagObj = availableTags.find((t) => t.id === tagId);
        if (tagObj) {
          setConversations((prev) =>
            prev.map((c) =>
              c.contact.id === activeContact.id && !c.contact.tags.some((t) => t.id === tagId)
                ? { ...c, contact: { ...c.contact, tags: [...c.contact.tags, tagObj] } }
                : c
            )
          );
        }
      }
      setTagModalOpen(false);
    });
  };

  const handleRemoveTag = (tagId: string) => {
    if (!activeContact) return;
    startTransition(async () => {
      const res = await removeTagFromContact(activeContact.id, tagId);
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) =>
            c.contact.id === activeContact.id
              ? { ...c, contact: { ...c.contact, tags: c.contact.tags.filter((t) => t.id !== tagId) } }
              : c
          )
        );
      }
    });
  };

  // Filtragem da lista
  const filteredConversations = conversations.filter((c) => {
    if (tabFilter === "ACTIVE24H" && !c.contact.is24hActive) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchName = c.contact.name?.toLowerCase().includes(q);
      const matchUser = c.contact.username?.toLowerCase().includes(q);
      return matchName || matchUser;
    }
    return true;
  });

  return (
    <div className="flex h-screen w-full bg-surface-100 overflow-hidden text-ink">
      {/* ── COLUNA 1: Lista de Conversas ─────────────────────────────────── */}
      <aside className="w-80 md:w-96 flex-none flex flex-col border-r border-border bg-surface-200">
        {/* Header da Barra de Conversas */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-primary" />
              <h2 className="text-base font-bold text-ink">Bate-Papo (Live Inbox)</h2>
            </div>
            <Link
              href="/contatos"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>Ver CRM</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          {/* Busca de conversas */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <input
              type="text"
              placeholder="Buscar por nome ou @user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-100 pl-9 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-subtle focus:border-primary focus:outline-none"
            />
          </div>

          {/* Abas de filtro rápido */}
          <div className="flex items-center gap-1 mt-3 p-1 rounded-xl bg-surface-300">
            <button
              onClick={() => setTabFilter("ALL")}
              className={`flex-1 py-1 text-center rounded-lg text-xs font-bold transition ${
                tabFilter === "ALL" ? "bg-surface-200 text-ink shadow-xs" : "text-ink-muted hover:text-ink"
              }`}
            >
              Todas ({conversations.length})
            </button>
            <button
              onClick={() => setTabFilter("ACTIVE24H")}
              className={`flex-1 py-1 text-center rounded-lg text-xs font-bold transition ${
                tabFilter === "ACTIVE24H" ? "bg-surface-200 text-emerald-500 shadow-xs" : "text-ink-muted hover:text-ink"
              }`}
            >
              24h Ativas ({conversations.filter((c) => c.contact.is24hActive).length})
            </button>
          </div>
        </div>

        {/* Lista de Threads */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">Nenhuma conversa encontrada.</div>
          ) : (
            filteredConversations.map((item) => {
              const isSelected = item.contact.id === activeContact?.id;
              return (
                <button
                  key={item.contact.id}
                  onClick={() => handleSelectContact(item.contact.id)}
                  className={`w-full flex items-start gap-3 p-3.5 text-left transition ${
                    isSelected
                      ? "bg-primary/10 border-l-4 border-primary"
                      : "hover:bg-surface-300/40"
                  }`}
                >
                  <div className="relative h-11 w-11 flex-none rounded-full overflow-hidden bg-surface-300 border border-border">
                    {item.contact.profilePicUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.contact.profilePicUrl}
                        alt={item.contact.username || ""}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-bold text-xs text-ink-muted uppercase">
                        {item.contact.username?.slice(0, 2) || "IG"}
                      </div>
                    )}
                    {/* Indicador de Janela 24h na foto */}
                    {item.contact.is24hActive && (
                      <span
                        className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-surface-200"
                        title="Janela de 24h aberta"
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-ink truncate">
                        {item.contact.name || item.contact.username}
                      </span>
                      {item.contact.is24hActive ? (
                        <span className="text-[10px] font-semibold text-emerald-500">
                          {item.contact.remainingHours24h}h
                        </span>
                      ) : (
                        <span className="text-[10px] text-ink-subtle">expirado</span>
                      )}
                    </div>
                    <span className="text-[11px] text-ink-muted">@{item.contact.username}</span>

                    <p className="mt-1 text-xs text-ink-muted truncate font-normal">
                      {item.lastMessage?.direction === "OUT" && (
                        <span className="font-semibold text-ink-subtle">Você: </span>
                      )}
                      {item.lastMessage?.text || "Sem mensagens"}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ── COLUNA 2: Janela de Chat ────────────────────────────────────── */}
      <section className="flex-1 flex flex-col bg-surface-100 min-w-0">
        {activeContact ? (
          <>
            {/* Topbar do Chat */}
            <div className="h-16 flex-none flex items-center justify-between border-b border-border bg-surface-200 px-6">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full overflow-hidden bg-surface-300 border border-border">
                  {activeContact.profilePicUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={activeContact.profilePicUrl}
                      alt={activeContact.username || ""}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-bold text-xs text-ink-muted">
                      {activeContact.username?.slice(0, 2)}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-ink">{activeContact.name || activeContact.username}</h3>
                    {activeContact.username && (
                      <a
                        href={`https://instagram.com/${activeContact.username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-ink-subtle hover:text-primary transition"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-ink-muted">@{activeContact.username}</span>
                    <span>·</span>
                    {activeContact.is24hActive ? (
                      <span className="text-emerald-500 font-semibold flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Janela 24h aberta ({activeContact.remainingHours24h}h restantes)
                      </span>
                    ) : (
                      <span className="text-ink-subtle flex items-center gap-1">
                        <Clock size={11} /> Janela 24h expirada
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowLeadDetails(!showLeadDetails)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${
                    showLeadDetails
                      ? "bg-surface-300 text-ink border-border"
                      : "bg-surface-200 text-ink-muted border-border hover:text-ink"
                  }`}
                >
                  {showLeadDetails ? "Ocultar Detalhes" : "Ver Detalhes do Lead"}
                </button>
              </div>
            </div>

            {/* Mensagens (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {thread.map((msg) => {
                const isOut = msg.direction === "OUT";
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isOut ? "items-end" : "items-start"} max-w-full`}
                  >
                    {/* Badge do tipo de mensagem */}
                    {msg.kind === "COMMENT" && (
                      <span className="text-[10px] font-semibold text-ink-subtle mb-1">
                        💬 Comentou no post
                      </span>
                    )}
                    {msg.kind === "COMMENT_REPLY" && (
                      <span className="text-[10px] font-semibold text-ink-subtle mb-1">
                        ↩️ Resposta pública no comentário
                      </span>
                    )}
                    {msg.kind === "POSTBACK" && (
                      <span className="text-[10px] font-semibold text-accent mb-1">
                        👆 Tocou num botão interativo
                      </span>
                    )}

                    {/* Balão da Mensagem */}
                    <div
                      className={`relative rounded-2xl p-4 max-w-md shadow-xs text-sm ${
                        isOut
                          ? "bg-primary text-white rounded-br-xs"
                          : "bg-surface-200 text-ink border border-border rounded-bl-xs"
                      }`}
                    >
                      <div className="whitespace-pre-line break-words">{msg.text}</div>

                      {/* Exibição de Botões se houver */}
                      {msg.kind === "BUTTONS" && msg.payload?.buttons && (
                        <div className="mt-3 pt-3 border-t border-white/20 flex flex-col gap-1.5">
                          {msg.payload.buttons.map((btn: any, idx: number) => (
                            <div
                              key={idx}
                              className="w-full text-center rounded-xl bg-white/20 hover:bg-white/30 py-1.5 text-xs font-bold uppercase tracking-wide transition select-none"
                            >
                              {btn.title}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Exibição de Cards de Carrossel se houver */}
                      {msg.kind === "CAROUSEL" && msg.payload?.cards && (
                        <div className="mt-3 pt-3 border-t border-white/20 flex gap-2 overflow-x-auto pb-1 max-w-sm">
                          {msg.payload.cards.map((card: any, idx: number) => (
                            <div
                              key={idx}
                              className="w-36 flex-none rounded-xl bg-white/10 p-2 text-white border border-white/20 text-xs"
                            >
                              <div className="font-bold line-clamp-1">{card.title}</div>
                              <div className="mt-2 w-full text-center rounded-lg bg-white/20 py-1 text-[10px] font-bold uppercase">
                                {card.buttonTitle}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Timestamp e Status */}
                      <div
                        className={`mt-1.5 text-[10px] flex items-center justify-end gap-1 ${
                          isOut ? "text-white/70" : "text-ink-subtle"
                        }`}
                      >
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {isOut && <CheckCircle2 size={11} />}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Aviso de Janela 24h & Composer */}
            <div className="p-4 border-t border-border bg-surface-200">
              {sendError && (
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-danger/10 p-3 text-xs font-semibold text-danger border border-danger/20">
                  <AlertCircle size={15} />
                  <span>{sendError}</span>
                </div>
              )}

              {/* Banner da Meta 24h Window */}
              {!activeContact.is24hActive ? (
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-500 border border-amber-500/20">
                  <ShieldAlert size={16} className="flex-none" />
                  <span>
                    <strong>Janela de 24 horas encerrada:</strong> Por política de privacidade da Meta,
                    você só pode enviar DMs manuais enquanto o seguidor estiver ativo nas últimas 24h.
                  </span>
                </div>
              ) : (
                <div className="mb-2 flex items-center justify-between text-[11px] text-emerald-500 font-semibold px-1">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Janela oficial da Meta ativa · Envio liberado
                  </span>
                  <span>{activeContact.remainingHours24h}h restantes</span>
                </div>
              )}

              {/* Caixa de Texto */}
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={
                    activeContact.is24hActive
                      ? "Digite uma resposta direta..."
                      : "Aguardando nova mensagem do seguidor para reabrir a janela de 24h..."
                  }
                  value={inputText}
                  disabled={!activeContact.is24hActive || isPending}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 rounded-xl border border-border bg-surface-100 px-4 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-primary focus:outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || !activeContact.is24hActive || isPending}
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-primary text-white shadow-xs hover:bg-primary-hover active:scale-95 disabled:opacity-40 transition"
                  title="Enviar mensagem"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-ink-muted text-sm">
            <MessageSquare size={32} className="mb-2 opacity-30" />
            Selecione uma conversa para visualizar.
          </div>
        )}
      </section>

      {/* ── COLUNA 3: Perfil e Detalhes do Lead (Drawer Direito) ─────────── */}
      {showLeadDetails && activeContact && (
        <aside className="w-80 flex-none border-l border-border bg-surface-200 p-6 flex flex-col overflow-y-auto">
          <div className="flex flex-col items-center text-center pb-6 border-b border-border">
            <div className="h-16 w-16 rounded-full overflow-hidden bg-surface-300 border border-border mb-3">
              {activeContact.profilePicUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeContact.profilePicUrl}
                  alt={activeContact.username || ""}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-bold text-lg text-ink-muted">
                  {activeContact.username?.slice(0, 2)}
                </div>
              )}
            </div>
            <h4 className="font-bold text-base text-ink">{activeContact.name || activeContact.username}</h4>
            <a
              href={`https://instagram.com/${activeContact.username}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
            >
              <span>@{activeContact.username}</span>
              <ExternalLink size={11} />
            </a>

            <div className="mt-3">
              {activeContact.followsAccount ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500">
                  <UserCheck size={12} /> Seguidor verificado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-300 px-2.5 py-0.5 text-xs font-semibold text-ink-muted">
                  <UserX size={12} /> Não segue a conta
                </span>
              )}
            </div>
          </div>

          {/* Seção de Etiquetas */}
          <div className="py-5 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
                Etiquetas (Tags)
              </span>
              <button
                type="button"
                onClick={() => setTagModalOpen(true)}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
              >
                <Plus size={12} /> Adicionar
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2">
              {activeContact.tags.length === 0 ? (
                <span className="text-xs text-ink-subtle italic">Nenhuma etiqueta atribuída</span>
              ) : (
                activeContact.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="group flex items-center gap-1 rounded-lg bg-surface-300 px-2 py-1 text-xs font-semibold text-ink border border-border"
                  >
                    <span>{tag.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag.id)}
                      className="text-ink-subtle hover:text-danger opacity-0 group-hover:opacity-100 transition"
                      title="Remover etiqueta"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Dados Técnicos da Meta */}
          <div className="py-5 space-y-3 text-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-subtle block">
              Dados do Instagram
            </span>
            <div>
              <span className="text-ink-subtle block">Instagram Scoped ID (IGSID)</span>
              <span className="font-mono text-ink text-[11px] select-all">{activeContact.igsid}</span>
            </div>
            <div>
              <span className="text-ink-subtle block">Fluxo de Entrada</span>
              <span className="text-ink font-semibold">{activeContact.sourceFlowName || "Direct / Orgânico"}</span>
            </div>
            <div>
              <span className="text-ink-subtle block">Primeiro Contato</span>
              <span className="text-ink">{new Date(activeContact.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </aside>
      )}

      {/* Modal para Adicionar Etiqueta */}
      {tagModalOpen && activeContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface-200 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <TagIcon size={16} className="text-primary" />
                <h3 className="font-bold text-sm text-ink">Adicionar Etiqueta ao Lead</h3>
              </div>
              <button onClick={() => setTagModalOpen(false)} className="text-ink-muted hover:text-ink">
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
              {availableTags.map((tag) => {
                const alreadyHas = activeContact.tags.some((t) => t.id === tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    disabled={alreadyHas || isPending}
                    onClick={() => handleAddTag(tag.id)}
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
