"use client";

import { useState } from "react";
import { Clapperboard, Image as ImageIcon } from "lucide-react";

/** Arquivo de vídeo (Reels): o Instagram devolve .mp4 em `media_url`, que não abre como imagem. */
export function isVideoUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    return /\.(mp4|mov|m4v|webm)$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** Imagem da capa a mostrar: a capa do vídeo quando houver; nunca o arquivo de vídeo. */
export function pickThumbnailUrl(item: { mediaType?: string; mediaUrl?: string; thumbnailUrl?: string }): string {
  if (item.mediaType === "VIDEO" || isVideoUrl(item.mediaUrl)) return item.thumbnailUrl || "";
  return item.mediaUrl || item.thumbnailUrl || "";
}

type Props = {
  url: string | undefined | null;
  alt: string;
  className?: string;
  iconSize?: number;
  /** Ícone do lugar vazio: vídeo ou imagem. */
  video?: boolean;
};

/**
 * Miniatura de publicação. Se não houver imagem (vídeo sem capa, URL vencida
 * do CDN do Instagram, bloqueio) mostra um ícone neutro — nunca a imagem
 * quebrada com o texto alternativo vazando.
 */
export function PostThumbnail({ url, alt, className = "", iconSize = 20, video = false }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const usable = url && !isVideoUrl(url) && failedUrl !== url ? url : null;

  if (!usable) {
    const Icon = video || isVideoUrl(url) ? Clapperboard : ImageIcon;
    return (
      <div role="img" aria-label={alt} className={`flex h-full w-full items-center justify-center bg-surface-300 text-ink-muted ${className}`}>
        <Icon size={iconSize} aria-hidden />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- CDN do Instagram com URL assinada; next/image exigiria liberar o domínio
    <img
      src={usable}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(usable)}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}
