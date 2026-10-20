// Content-Security-Policy com nonce por requisição (o Next aplica o nonce aos
// próprios scripts quando lê este cabeçalho no request). Estilos inline ficam
// liberados porque React Flow e atributos style= dependem deles.

export function generateNonce(): string {
  return btoa(crypto.randomUUID());
}

/** `storageOrigin`: origem do Supabase Storage, para o upload direto de mídia do Autoposter. */
export function buildContentSecurityPolicy(nonce: string, isDev: boolean, storageOrigin?: string): string {
  const storage = storageOrigin && /^https:\/\/[a-z0-9.-]+$/i.test(storageOrigin) ? ` ${storageOrigin}` : "";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // Fotos de perfil e posts vêm das CDNs do Instagram/Facebook.
    "img-src 'self' blob: data: https:",
    // Prévia dos vídeos do Autoposter (Storage) e das CDNs da Meta.
    "media-src 'self' blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${storage}${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!isDev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
