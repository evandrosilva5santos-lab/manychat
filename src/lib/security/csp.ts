// Content-Security-Policy com nonce por requisição (o Next aplica o nonce aos
// próprios scripts quando lê este cabeçalho no request). Estilos inline ficam
// liberados porque React Flow e atributos style= dependem deles.

export function generateNonce(): string {
  return btoa(crypto.randomUUID());
}

export function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // Fotos de perfil e posts vêm das CDNs do Instagram/Facebook.
    "img-src 'self' blob: data: https:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!isDev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
