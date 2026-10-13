/** Destino depois do login. Só caminhos internos: `/x` sim; `//site`, `https://` e `/\` não (evita redirecionamento aberto). */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}
