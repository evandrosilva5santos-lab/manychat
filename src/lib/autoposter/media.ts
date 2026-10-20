// Utilitários de mídia sem dependências (servidor e navegador).

const VIDEO_RE = /\.(mp4|mov|m4v|webm)(\?|$)/i;

export function isVideoUrl(url: string): boolean {
  return VIDEO_RE.test(url);
}

/** Aceita só URLs https (mídia do nosso bucket ou link público colado). */
export function isAcceptableMediaUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.length > 3;
  } catch {
    return false;
  }
}
