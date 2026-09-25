"use client";

import { useState } from "react";
import {
  Check,
  Clapperboard,
  Copy,
  ExternalLink,
  Film,
  Layers,
  X,
} from "lucide-react";

export type InstagramPost = {
  id: string;
  type: "CAROUSEL" | "REEL" | "POST";
  url: string;
  caption: string;
  shortTitle: string;
  relativeTime: string;
  date: string;
  likes: number;
  comments: number;
};

export const MOCK_POSTS: InstagramPost[] = [
  {
    id: "post-1",
    type: "CAROUSEL",
    url: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&auto=format&fit=crop&q=80",
    caption:
      "É PEDIR DEMAIS? 🥺🙏 Heeey Moving Maníacos 🗣 O que vocês também ELIMINARIAM? ❌ Garanta hoje o seu ingresso (link na bio @movingfestival)",
    shortTitle: "É PEDIR DEMAIS? 🥺...",
    relativeTime: "há 9 horas",
    date: "24 Sep, 2026",
    likes: 261,
    comments: 2,
  },
  {
    id: "post-2",
    type: "REEL",
    url: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80",
    caption:
      "💍 Chegou a hora do Casamento na Moving 2026! Quem aí sonha em viver esse momento? Comente CASAMENTO para garantir sua inscrição exclusiva.",
    shortTitle: "Chegou a hora do C...",
    relativeTime: "há 10 horas",
    date: "24 Sep, 2026",
    likes: 1420,
    comments: 89,
  },
  {
    id: "post-3",
    type: "REEL",
    url: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80",
    caption:
      "FALTA MUITO? 🥹🗣 Contando os segundos pra curtir o maior festival da sua vida! Comente CASAMENTO.",
    shortTitle: "FALTA MUITO? 🥹🗣...",
    relativeTime: "há 12 horas",
    date: "23 Sep, 2026",
    likes: 890,
    comments: 44,
  },
  {
    id: "post-4",
    type: "REEL",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80",
    caption:
      "Dia 17 e 18/10 nosso encontro está marcado! Garanta seu ingresso antecipado.",
    shortTitle: "Dia 17 e 18/10 en...",
    relativeTime: "há 16 horas",
    date: "23 Sep, 2026",
    likes: 3100,
    comments: 215,
  },
  {
    id: "post-5",
    type: "CAROUSEL",
    url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80",
    caption:
      "Ao contrário do seu ex, a Moving nunca decepciona! 💅 Comente CASAMENTO.",
    shortTitle: "Ao contrário do seu ...",
    relativeTime: "há 16 horas",
    date: "22 Sep, 2026",
    likes: 670,
    comments: 32,
  },
  {
    id: "post-6",
    type: "REEL",
    url: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop&q=80",
    caption:
      "EU VOU VIVER ISSO! Pandora confirmada na Moving 2026! Comente CASAMENTO.",
    shortTitle: "EU VOU VIVER ISSO ...",
    relativeTime: "há 16 horas",
    date: "22 Sep, 2026",
    likes: 1850,
    comments: 102,
  },
];

type Props = {
  mediaId?: string;
  mediaUrl?: string;
  mediaCaption?: string;
  onSelect: (post: { id: string; url: string; caption: string }) => void;
  onClear: () => void;
};

export function PostPicker({
  mediaId,
  mediaUrl,
  mediaCaption,
  onSelect,
  onClear,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [customCaption, setCustomCaption] = useState("");

  const currentMediaId = mediaId || "post-1";

  const handleSelect = (post: InstagramPost) => {
    onSelect({ id: post.id, url: post.url, caption: post.caption });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    onSelect({
      id: `custom-${Date.now()}`,
      url: customUrl.trim(),
      caption: customCaption.trim() || "Publicação personalizada",
    });
    setModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-3 pt-1">
      {/* ── LINHA DE 4 MINIATURAS HORIZONTAIS (Exatamente como no print 3) ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {MOCK_POSTS.slice(0, 4).map((post) => {
          const isSelected = currentMediaId === post.id;
          return (
            <button
              key={post.id}
              type="button"
              onClick={() => handleSelect(post)}
              className={`group relative h-17 w-17 flex-none overflow-hidden rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? "border-primary ring-2 ring-primary/40 shadow-sm scale-102"
                  : "border-border hover:border-primary/50 opacity-80 hover:opacity-100"
              }`}
              title={post.caption}
            >
              <img
                src={post.url}
                alt={post.shortTitle}
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {/* Ícone no topo direito */}
              <div className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded bg-black/60 text-white">
                {post.type === "CAROUSEL" ? (
                  <Copy size={9} />
                ) : (
                  <Clapperboard size={9} />
                )}
              </div>
              {/* Check de seleção */}
              {isSelected && (
                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow-xs">
                    <Check size={12} strokeWidth={3} />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Botão "Mostrar Todos" com estilo ManyChat */}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="self-start rounded-lg border border-primary/40 bg-surface-100 hover:bg-surface-300 px-3.5 py-1.5 text-xs font-bold text-primary transition-all shadow-xs"
      >
        Mostrar Todos
      </button>

      {/* ── MODAL DE SELEÇÃO DE POSTS (Idêntico ao print 5) ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="flex flex-col w-full max-w-2xl max-h-[85vh] rounded-2xl border border-border bg-surface-100 shadow-pop overflow-hidden">
            {/* Header do Modal */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-surface-200">
              <h3 className="text-base font-bold text-ink">
                Selecione qualquer publicação ou reel para automatizar
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-300 text-ink-muted hover:text-ink transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Grid de 3 Colunas com os Cards (Exatamente como no print 5) */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-3 gap-4">
                {MOCK_POSTS.map((post) => {
                  const isSelected = currentMediaId === post.id;
                  return (
                    <div
                      key={post.id}
                      onClick={() => {
                        handleSelect(post);
                        setModalOpen(false);
                      }}
                      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-surface-200 transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/40 shadow-md"
                          : "border-border hover:border-primary/50 hover:shadow-sm"
                      }`}
                    >
                      {/* Imagem do Post com ícone de Carrossel ou Reel */}
                      <div className="relative aspect-square w-full overflow-hidden bg-surface-300">
                        <img
                          src={post.url}
                          alt={post.shortTitle}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {/* Ícone característico do ManyChat no canto superior direito */}
                        <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded bg-black/70 text-white backdrop-blur-xs">
                          {post.type === "CAROUSEL" ? (
                            <Copy size={13} />
                          ) : (
                            <Clapperboard size={13} />
                          )}
                        </div>
                      </div>

                      {/* Título e Horário / Botão Ver no Instagram */}
                      <div className="flex flex-col p-3 gap-1">
                        {isSelected ? (
                          <span className="text-xs font-bold text-primary hover:underline">
                            Ver no Instagram
                          </span>
                        ) : (
                          <p className="line-clamp-1 text-xs font-bold text-ink">
                            {post.shortTitle}
                          </p>
                        )}
                        <span className="text-[11px] text-ink-muted">
                          {post.relativeTime}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Colar Link Personalizado */}
              <div className="mt-6 rounded-xl border border-border bg-surface-200 p-4">
                <span className="text-xs font-bold text-ink">
                  Ou cole o link direto de uma imagem / publicação:
                </span>
                <form onSubmit={handleCustomSubmit} className="mt-2 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      className="fx-input text-xs font-mono flex-1"
                      placeholder="https://exemplo.com/imagem-do-post.jpg"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={!customUrl.trim()}
                      className="rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold px-4 py-1.5 text-xs transition-all flex-none shadow-xs"
                    >
                      Aplicar
                    </button>
                  </div>
                  <input
                    className="fx-input text-xs"
                    placeholder="Legenda da publicação (opcional)"
                    value={customCaption}
                    onChange={(e) => setCustomCaption(e.target.value)}
                  />
                </form>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3 bg-surface-200">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-border bg-surface-100 hover:bg-surface-300 px-4 py-1.5 text-xs font-semibold text-ink transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
