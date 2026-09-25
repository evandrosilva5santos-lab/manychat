"use client";

import React, { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  LayoutGrid,
  Plus,
  Search,
  ExternalLink,
  CornerDownRight,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  X,
  Layers,
  Sparkles,
  Link2,
  ArrowRight,
  Info,
} from "lucide-react";
import {
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  type CatalogItemWithUsages,
  type CardButtonType,
} from "./actions";

interface CatalogClientProps {
  initialItems: CatalogItemWithUsages[];
}

const PRESET_IMAGES = [
  {
    name: "Alianças & Luxo",
    url: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80",
  },
  {
    name: "Decoração Floral",
    url: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&auto=format&fit=crop&q=80",
  },
  {
    name: "Cerimônia ao Ar Livre",
    url: "https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=800&auto=format&fit=crop&q=80",
  },
  {
    name: "Brinde & Recepção",
    url: "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&auto=format&fit=crop&q=80",
  },
];

export function CatalogClient({ initialItems }: CatalogClientProps) {
  const [items, setItems] = useState<CatalogItemWithUsages[]>(initialItems);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "URL" | "POSTBACK">("ALL");
  const [isPending, startTransition] = useTransition();

  // Estado do Modal (Criação / Edição)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItemWithUsages | null>(null);

  // Formulário
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState(PRESET_IMAGES[0].url);
  const [buttonTitle, setButtonTitle] = useState("");
  const [buttonType, setButtonType] = useState<CardButtonType>("URL");
  const [buttonUrl, setButtonUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filtros aplicados
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterType === "URL") return item.buttonType === "URL";
    if (filterType === "POSTBACK") return item.buttonType === "POSTBACK";
    return true;
  });

  // Estatísticas
  const totalCards = items.length;
  const inUseCount = items.filter((i) => i.usageCount > 0).length;
  const postbackCount = items.filter((i) => i.buttonType === "POSTBACK").length;
  const urlCount = items.filter((i) => i.buttonType === "URL").length;

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setTitle("");
    setDescription("");
    setImageUrl(PRESET_IMAGES[0].url);
    setButtonTitle("QUERO PARTICIPAR");
    setButtonType("URL");
    setButtonUrl("https://wa.me/5551994044194");
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: CatalogItemWithUsages) => {
    setEditingItem(item);
    setTitle(item.title);
    setDescription(item.description || "");
    setImageUrl(item.imageUrl);
    setButtonTitle(item.buttonTitle);
    setButtonType(item.buttonType);
    setButtonUrl(item.buttonUrl || "");
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    setFormError(null);

    // Validação preliminar
    if (!title.trim()) {
      setFormError("Informe o título do card.");
      return;
    }
    if (title.length > 80) {
      setFormError("O título não pode exceder 80 caracteres (limite da Meta).");
      return;
    }
    if (description.length > 80) {
      setFormError("A descrição não pode exceder 80 caracteres (limite da Meta).");
      return;
    }
    if (!imageUrl.trim()) {
      setFormError("Informe a URL da imagem.");
      return;
    }
    if (!buttonTitle.trim()) {
      setFormError("Informe o texto do botão.");
      return;
    }
    if (buttonTitle.length > 20) {
      setFormError("O texto do botão não pode exceder 20 caracteres.");
      return;
    }
    if (buttonType === "URL" && (!buttonUrl.trim() || !buttonUrl.startsWith("http"))) {
      setFormError("Informe um link de destino válido com https:// ou http://");
      return;
    }

    startTransition(async () => {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim(),
        buttonTitle: buttonTitle.trim().toUpperCase(),
        buttonType,
        buttonUrl: buttonType === "URL" ? buttonUrl.trim() : undefined,
      };

      if (editingItem) {
        const res = await updateCatalogItem(editingItem.id, payload);
        if (res.ok) {
          setItems((prev) => prev.map((item) => (item.id === editingItem.id ? res.item : item)));
          setIsModalOpen(false);
          setFeedbackMsg({ type: "success", text: "Card atualizado com sucesso!" });
          setTimeout(() => setFeedbackMsg(null), 4000);
        } else {
          setFormError(res.error);
        }
      } else {
        const res = await createCatalogItem(payload);
        if (res.ok) {
          setItems((prev) => [res.item, ...prev]);
          setIsModalOpen(false);
          setFeedbackMsg({ type: "success", text: "Novo card criado no catálogo!" });
          setTimeout(() => setFeedbackMsg(null), 4000);
        } else {
          setFormError(res.error);
        }
      }
    });
  };

  const handleDelete = (item: CatalogItemWithUsages) => {
    if (item.usageCount > 0) {
      alert(
        `Este card está em uso em ${item.usageCount} carrossel(is):\n${item.usages
          .map((u) => `• ${u.flowName}`)
          .join("\n")}\n\nPara excluí-lo, remova-o dos fluxos acima primeiro.`
      );
      return;
    }

    if (!confirm(`Deseja realmente excluir o card "${item.title}"?`)) return;

    startTransition(async () => {
      const res = await deleteCatalogItem(item.id);
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setFeedbackMsg({ type: "success", text: "Card removido do catálogo." });
        setTimeout(() => setFeedbackMsg(null), 4000);
      } else {
        alert(res.error);
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
                <LayoutGrid size={20} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-ink">Catálogo de Cards</h1>
              <span className="rounded-full bg-accent-muted/20 px-2 py-0.5 text-xs font-semibold text-accent">
                Etapa 5 · Reutilizável
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              Crie cards deslizantes (1:1) com título, descrição e botões fixos para enviar carrosséis no Direct do
              Instagram.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/fluxos"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-300 px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-surface-300/80"
            >
              <Layers size={16} />
              Ver Fluxos
            </Link>
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-primary-hover active:scale-[0.98]"
            >
              <Plus size={18} />
              Novo Card
            </button>
          </div>
        </div>
      </header>

      {/* Alerta de Feedback */}
      {feedbackMsg && (
        <div className="max-w-7xl mx-auto w-full px-8 pt-4">
          <div
            className={`flex items-center gap-3 rounded-xl p-3.5 text-sm font-medium ${
              feedbackMsg.type === "success"
                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                : "bg-danger/10 text-danger border border-danger/20"
            }`}
          >
            {feedbackMsg.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedbackMsg.text}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-8 py-8">
        {/* Barra de Métricas Rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-2xl border border-border bg-surface-200 p-4">
            <span className="text-xs font-medium text-ink-subtle">Total de Cards</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-ink">{totalCards}</span>
              <span className="text-xs text-ink-muted">cadastrados</span>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface-200 p-4">
            <span className="text-xs font-medium text-ink-subtle">Em Uso nos Fluxos</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-accent">{inUseCount}</span>
              <span className="text-xs text-ink-muted">ativos em carrosséis</span>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface-200 p-4">
            <span className="text-xs font-medium text-ink-subtle">Com Link Externo</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-primary">{urlCount}</span>
              <span className="text-xs text-ink-muted">WhatsApp / Site</span>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface-200 p-4">
            <span className="text-xs font-medium text-ink-subtle">Com Próximo Passo</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-fuchsia-400">{postbackCount}</span>
              <span className="text-xs text-ink-muted">avançam o fluxo</span>
            </div>
          </div>
        </div>

        {/* Busca e Filtros */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <input
              type="text"
              placeholder="Buscar por título ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-200 pl-10 pr-4 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-200 border border-border">
            <button
              onClick={() => setFilterType("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterType === "ALL" ? "bg-surface-300 text-ink shadow-xs" : "text-ink-muted hover:text-ink"
              }`}
            >
              Todos ({totalCards})
            </button>
            <button
              onClick={() => setFilterType("URL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterType === "URL" ? "bg-surface-300 text-ink shadow-xs" : "text-ink-muted hover:text-ink"
              }`}
            >
              Links ({urlCount})
            </button>
            <button
              onClick={() => setFilterType("POSTBACK")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterType === "POSTBACK" ? "bg-surface-300 text-ink shadow-xs" : "text-ink-muted hover:text-ink"
              }`}
            >
              Próximo Passo ({postbackCount})
            </button>
          </div>
        </div>

        {/* Grade de Cards do Catálogo */}
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-200/50 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-300 text-ink-muted">
              <LayoutGrid size={24} />
            </div>
            <h3 className="mt-4 text-base font-semibold text-ink">Nenhum card encontrado</h3>
            <p className="mt-1 text-sm text-ink-muted max-w-sm">
              {searchTerm ? "Tente buscar com outros termos ou limpe o filtro." : "Crie o primeiro card para o seu catálogo."}
            </p>
            {searchTerm ? (
              <button
                onClick={() => setSearchTerm("")}
                className="mt-4 text-xs font-medium text-primary hover:underline"
              >
                Limpar busca
              </button>
            ) : (
              <button
                onClick={handleOpenCreateModal}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-hover"
              >
                <Plus size={14} /> Criar Primeiro Card
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="group relative flex flex-col rounded-2xl border border-border bg-surface-200 overflow-hidden shadow-xs hover:border-primary/40 transition-all"
              >
                {/* Imagem do Card (Proporção 1:1 quadrada do Instagram) */}
                <div className="relative aspect-square w-full bg-surface-300 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    {item.buttonType === "URL" ? (
                      <span className="flex items-center gap-1 rounded-full bg-blue-500/90 backdrop-blur-md px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs">
                        <ExternalLink size={12} /> Link Externo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-fuchsia-600/90 backdrop-blur-md px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs">
                        <CornerDownRight size={12} /> Próximo Passo
                      </span>
                    )}
                  </div>

                  {item.usageCount > 0 && (
                    <div
                      className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-surface-200/90 backdrop-blur-md px-2.5 py-0.5 text-[11px] font-semibold text-accent shadow-xs"
                      title={item.usages.map((u) => u.flowName).join(", ")}
                    >
                      <span>Usado em {item.usageCount} {item.usageCount === 1 ? "fluxo" : "fluxos"}</span>
                    </div>
                  )}
                </div>

                {/* Conteúdo do Card */}
                <div className="flex-1 flex flex-col p-5">
                  <h3 className="text-base font-bold text-ink line-clamp-1" title={item.title}>
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs text-ink-muted line-clamp-2 min-h-[32px]">
                    {item.description || <span className="italic text-ink-subtle">Sem descrição</span>}
                  </p>

                  {/* Simulação do Botão Fixo no Instagram */}
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="w-full flex items-center justify-center rounded-xl bg-surface-300 hover:bg-surface-300/80 px-3 py-2 text-xs font-bold text-ink uppercase tracking-wide border border-border transition select-none">
                      {item.buttonTitle}
                    </div>
                    {item.buttonType === "URL" && item.buttonUrl && (
                      <a
                        href={item.buttonUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 flex items-center justify-center gap-1 text-[11px] text-ink-subtle hover:text-primary transition truncate"
                      >
                        <Link2 size={12} />
                        <span className="truncate">{item.buttonUrl}</span>
                      </a>
                    )}
                  </div>

                  {/* Rodapé com Ações */}
                  <div className="mt-4 pt-3 flex items-center justify-between text-xs text-ink-subtle border-t border-border/50">
                    <span className="text-[11px]">Máx. 80 chars Meta</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(item)}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-ink-muted hover:bg-surface-300 hover:text-ink transition"
                      >
                        <Edit2 size={13} />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={item.usageCount > 0}
                        title={
                          item.usageCount > 0
                            ? "Não é possível excluir um card em uso em fluxos"
                            : "Excluir card"
                        }
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
                          item.usageCount > 0
                            ? "opacity-30 cursor-not-allowed text-ink-subtle"
                            : "text-ink-muted hover:bg-danger/10 hover:text-danger"
                        }`}
                      >
                        <Trash2 size={13} />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal de Criação / Edição com Preview ao Vivo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative flex flex-col lg:flex-row max-w-4xl w-full max-h-[90vh] bg-surface-200 rounded-3xl border border-border shadow-2xl overflow-hidden">
            {/* Formulário (Lado Esquerdo) */}
            <div className="flex-1 flex flex-col p-6 lg:p-8 overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                  <h2 className="text-lg font-bold text-ink">
                    {editingItem ? "Editar Card do Catálogo" : "Novo Card do Catálogo"}
                  </h2>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Configuração de card reutilizável compatível com as regras da Meta Graph API.
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full p-2 text-ink-muted hover:bg-surface-300 hover:text-ink"
                >
                  <X size={18} />
                </button>
              </div>

              {formError && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-danger/10 p-3 text-xs font-semibold text-danger border border-danger/20">
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="mt-6 space-y-4">
                {/* Título do Card */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-ink">Título do Card *</label>
                    <span
                      className={`text-[11px] font-mono ${
                        title.length > 80 ? "text-danger font-bold" : "text-ink-subtle"
                      }`}
                    >
                      {title.length}/80
                    </span>
                  </div>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Vestido de Noiva Royal 2026"
                    maxLength={80}
                    className="w-full rounded-xl border border-border bg-surface-100 px-3.5 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-primary focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-ink-subtle">Limite de 80 caracteres exigido pela Meta.</p>
                </div>

                {/* Descrição / Subtítulo */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-ink">Subtítulo / Descrição</label>
                    <span
                      className={`text-[11px] font-mono ${
                        description.length > 80 ? "text-danger font-bold" : "text-ink-subtle"
                      }`}
                    >
                      {description.length}/80
                    </span>
                  </div>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Exclusividade Moving Wedding com tecido francês"
                    maxLength={80}
                    className="w-full rounded-xl border border-border bg-surface-100 px-3.5 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-primary focus:outline-none"
                  />
                </div>

                {/* Imagem do Card */}
                <div>
                  <label className="text-xs font-bold text-ink mb-1 block">URL da Imagem (1:1 Quadrada) *</label>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://exemplo.com/foto.jpg"
                    className="w-full rounded-xl border border-border bg-surface-100 px-3.5 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-primary focus:outline-none"
                  />
                  {/* Atalhos com fotos de casamento */}
                  <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
                    <span className="text-[11px] text-ink-subtle whitespace-nowrap flex items-center gap-1">
                      <Sparkles size={12} className="text-accent" /> Sugestões:
                    </span>
                    {PRESET_IMAGES.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setImageUrl(preset.url)}
                        className={`text-[11px] px-2 py-0.5 rounded-lg border whitespace-nowrap transition ${
                          imageUrl === preset.url
                            ? "bg-primary/10 border-primary text-primary font-bold"
                            : "bg-surface-300 border-border text-ink-muted hover:text-ink"
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tipo de Ação do Botão */}
                <div className="pt-2 border-t border-border">
                  <label className="text-xs font-bold text-ink mb-2 block">Ação do Botão Fixo</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setButtonType("URL")}
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                        buttonType === "URL"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-surface-100 text-ink-muted hover:text-ink"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <ExternalLink size={14} /> Link Externo
                      </div>
                      <span className="text-[11px] mt-1 opacity-80">Abre WhatsApp, site ou checkout</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setButtonType("POSTBACK")}
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                        buttonType === "POSTBACK"
                          ? "border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-400"
                          : "border-border bg-surface-100 text-ink-muted hover:text-ink"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <CornerDownRight size={14} /> Próximo Passo
                      </div>
                      <span className="text-[11px] mt-1 opacity-80">Gera uma saída própria no canvas</span>
                    </button>
                  </div>
                </div>

                {/* Texto do Botão */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-ink">Texto do Botão *</label>
                    <span
                      className={`text-[11px] font-mono ${
                        buttonTitle.length > 20 ? "text-danger font-bold" : "text-ink-subtle"
                      }`}
                    >
                      {buttonTitle.length}/20
                    </span>
                  </div>
                  <input
                    type="text"
                    value={buttonTitle}
                    onChange={(e) => setButtonTitle(e.target.value.toUpperCase())}
                    placeholder="Ex: QUERO ESTE PACOTE"
                    maxLength={20}
                    className="w-full rounded-xl border border-border bg-surface-100 px-3.5 py-2 text-sm text-ink uppercase tracking-wide placeholder:text-ink-subtle focus:border-primary focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-ink-subtle">
                    Máx. 20 caracteres em caixa alta (padrão de legibilidade no Direct).
                  </p>
                </div>

                {/* URL de Destino (se tipo URL) */}
                {buttonType === "URL" && (
                  <div>
                    <label className="text-xs font-bold text-ink mb-1 block">Link de Destino *</label>
                    <input
                      type="url"
                      value={buttonUrl}
                      onChange={(e) => setButtonUrl(e.target.value)}
                      placeholder="https://wa.me/5551994044194"
                      className="w-full rounded-xl border border-border bg-surface-100 px-3.5 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-primary focus:outline-none"
                    />
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setButtonUrl(
                            "https://wa.me/5551994044194?text=Oi%21%20Vim%20pelo%20Instagram%20e%20quero%20saber%20mais"
                          )
                        }
                        className="text-[11px] text-accent hover:underline flex items-center gap-1"
                      >
                        <Plus size={11} /> Usar WhatsApp da Moving
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Botões do Rodapé */}
              <div className="mt-8 pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50"
                >
                  {isPending ? "Salvando..." : editingItem ? "Salvar Alterações" : "Criar Card"}
                </button>
              </div>
            </div>

            {/* Preview do Direct no Instagram (Lado Direito) */}
            <div className="lg:w-80 bg-surface-300/60 border-t lg:border-t-0 lg:border-l border-border p-6 flex flex-col items-center justify-center">
              <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Info size={13} /> Prévia no Instagram Direct
              </span>

              {/* Mockup de Card do Carrossel */}
              <div className="w-64 rounded-2xl bg-surface-200 border border-border overflow-hidden shadow-lg select-none">
                <div className="relative aspect-square w-full bg-surface-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl || PRESET_IMAGES[0].url}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as any).src = PRESET_IMAGES[0].url;
                    }}
                  />
                  <div className="absolute top-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                    1 de 5
                  </div>
                </div>
                <div className="p-3.5">
                  <div className="font-bold text-xs text-ink line-clamp-1">{title || "Título do Card"}</div>
                  <div className="mt-0.5 text-[11px] text-ink-muted line-clamp-2 min-h-[28px]">
                    {description || "Descrição breve do pacote ou serviço..."}
                  </div>
                  <div className="mt-3">
                    <div className="w-full flex items-center justify-center rounded-xl bg-surface-300 py-1.5 text-xs font-bold text-ink uppercase tracking-wide border border-border">
                      {buttonTitle || "ESCOLHER"}
                    </div>
                  </div>
                </div>
              </div>

              <span className="mt-4 text-[11px] text-center text-ink-subtle max-w-[220px]">
                O carrossel suporta de 1 a 10 cards lado a lado com rolagem horizontal nativa.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
