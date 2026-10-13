"use client";

import { useState, useEffect } from "react";
import {
  Check,
  Clapperboard,
  Copy,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  X,
  ExternalLink,
} from "lucide-react";
import type { InstagramMediaItem } from "@/lib/meta/graph";
import { MAX_MEDIA_CAPTION } from "@/lib/flow/recipe";

export type InstagramPost = {
  id: string;
  type: "CAROUSEL" | "REEL" | "POST";
  url: string;
  caption: string;
  shortTitle: string;
  relativeTime: string;
  permalink?: string;
  likes: number;
  comments: number;
};

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
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [customCaption, setCustomCaption] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadMedia() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/instagram/media?limit=12");
        const json = await res.json();
        if (!isMounted) return;

        if (json.success && Array.isArray(json.data)) {
          const mapped: InstagramPost[] = json.data.map((item: InstagramMediaItem) => {
            const rawType = item.mediaType || "IMAGE";
            const postType: InstagramPost["type"] =
              rawType === "CAROUSEL_ALBUM"
                ? "CAROUSEL"
                : rawType === "VIDEO"
                ? "REEL"
                : "POST";

            const caption = (item.caption || "Sem legenda").slice(0, MAX_MEDIA_CAPTION);
            const shortTitle = caption.length > 24 ? `${caption.slice(0, 24)}...` : caption;

            return {
              id: item.id,
              type: postType,
              url: item.mediaUrl || item.thumbnailUrl || "",
              caption,
              shortTitle,
              relativeTime: item.timestamp
                ? new Date(item.timestamp).toLocaleDateString("pt-BR")
                : "",
              permalink: item.permalink,
              likes: item.likeCount || 0,
              comments: item.commentsCount || 0,
            };
          });
          setPosts(mapped);
        } else {
          setError(json.error || "Não foi possível carregar as publicações.");
        }
      } catch {
        if (!isMounted) return;
        setError("Erro de conexão ao buscar publicações.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadMedia();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelect = (post: InstagramPost) => {
    onSelect({ id: post.id, url: post.url, caption: post.caption });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);

    const trimmed = customUrl.trim();
    if (!trimmed.startsWith("https://www.instagram.com/") && !trimmed.startsWith("https://instagram.com/")) {
      setUrlError("O link precisa ser uma URL válida do Instagram (ex: https://www.instagram.com/p/...).");
      return;
    }

    // Extrai o ID da mídia ou gera identificador seguro
    const idMatch = trimmed.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
    const resolvedId = idMatch ? `ig_${idMatch[1]}` : `custom_${Date.now()}`;

    onSelect({
      id: resolvedId,
      url: trimmed,
      caption: customCaption.trim() || "Publicação do Instagram",
    });
    setModalOpen(false);
    setCustomUrl("");
    setCustomCaption("");
  };

  return (
    <div className="flex flex-col gap-3 pt-1">
      {/* ── ESTADOS DE CARREGAMENTO / ERRO / MINIATURAS ── */}
      {loading ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-17 w-17 flex-none animate-pulse rounded-xl bg-surface-300 flex items-center justify-center text-ink-muted/30"
            >
              <ImageIcon size={20} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger flex items-start gap-2">
          <AlertCircle size={16} className="flex-none mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{error}</p>
            <p className="text-[11px] text-ink-muted mt-0.5">
              Você pode inserir o link direto da publicação abaixo ou verificar a conta em Ajustes.
            </p>
          </div>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-200 p-3 text-xs text-ink-muted text-center">
          Nenhuma publicação encontrada na conta conectada.
        </div>
      ) : (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {posts.slice(0, 4).map((post) => {
            const isSelected = mediaId === post.id;
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
                {post.url ? (
                  <img
                    src={post.url}
                    alt={post.shortTitle}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="h-full w-full bg-surface-300 flex items-center justify-center text-ink-muted">
                    <ImageIcon size={20} />
                  </div>
                )}
                {/* Ícone no topo direito */}
                <div className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded bg-black/60 text-white">
                  {post.type === "CAROUSEL" ? (
                    <Copy size={9} />
                  ) : post.type === "REEL" ? (
                    <Clapperboard size={9} />
                  ) : (
                    <ImageIcon size={9} />
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
      )}

      {/* Botão para abrir modal ou adicionar link manual */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-lg border border-primary/40 bg-surface-100 hover:bg-surface-300 px-3.5 py-1.5 text-xs font-bold text-primary transition-all shadow-xs"
        >
          {posts.length > 0 ? "Ver todas as publicações" : "Inserir link de publicação"}
        </button>
        {mediaId && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-ink-muted hover:text-danger underline transition-colors"
          >
            Remover filtro de post
          </button>
        )}
      </div>

      {/* ── MODAL DE SELEÇÃO DE POSTS ── */}
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

            {/* Grid de Posts ou Formulário de Link */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-ink-muted gap-2">
                  <Loader2 size={24} className="animate-spin text-primary" />
                  <span className="text-xs">Buscando publicações do perfil...</span>
                </div>
              ) : posts.length > 0 ? (
                <div className="grid grid-cols-3 gap-4">
                  {posts.map((post) => {
                    const isSelected = mediaId === post.id;
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
                        <div className="relative aspect-square w-full overflow-hidden bg-surface-300">
                          {post.url ? (
                            <img
                              src={post.url}
                              alt={post.shortTitle}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-ink-muted">
                              <ImageIcon size={24} />
                            </div>
                          )}
                          <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded bg-black/70 text-white backdrop-blur-xs">
                            {post.type === "CAROUSEL" ? (
                              <Copy size={13} />
                            ) : post.type === "REEL" ? (
                              <Clapperboard size={13} />
                            ) : (
                              <ImageIcon size={13} />
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col p-3 gap-1">
                          <p className="line-clamp-1 text-xs font-bold text-ink">
                            {post.shortTitle}
                          </p>
                          <span className="text-[11px] text-ink-muted">
                            {post.relativeTime}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-surface-200 p-6 text-center text-xs text-ink-muted">
                  Nenhuma publicação encontrada pela API.
                </div>
              )}

              {/* Colar Link do Instagram */}
              <div className="mt-6 rounded-xl border border-border bg-surface-200 p-4">
                <span className="text-xs font-bold text-ink">
                  Ou vincule colando o link de uma publicação do Instagram:
                </span>
                <form onSubmit={handleCustomSubmit} className="mt-2 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      className="fx-input text-xs font-mono flex-1"
                      placeholder="https://www.instagram.com/p/..."
                      value={customUrl}
                      onChange={(e) => {
                        setCustomUrl(e.target.value);
                        setUrlError(null);
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!customUrl.trim()}
                      className="rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold px-4 py-1.5 text-xs transition-all flex-none shadow-xs"
                    >
                      Aplicar
                    </button>
                  </div>
                  {urlError && (
                    <span className="text-[11px] text-danger">{urlError}</span>
                  )}
                  <input
                    className="fx-input text-xs"
                    placeholder="Identificação / legenda da publicação (opcional)"
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
