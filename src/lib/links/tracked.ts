// Links rastreados: botões com URL apontam para /api/l/{code}. A rota conta o
// clique e redireciona só para a URL salva no banco (nunca para uma URL da query).

const LINK_CODE_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const LINK_CODE_BYTES = 12;

export function generateLinkCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(LINK_CODE_BYTES));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isValidLinkCode(code: string): boolean {
  return LINK_CODE_PATTERN.test(code);
}

/** Só https, com host, sem usuário/senha embutidos na URL. */
export function isSafeHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}
