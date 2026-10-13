const INACTIVE_LINK_MESSAGE = "Este link não está mais ativo. Peça um novo a quem cuida da sua conta.";

/** Troca o erro técnico de convite inválido/expirado/de workspace removido por um texto que a pessoa entende. */
export function friendlyConnectError(error: string | null | undefined): string | null {
  if (!error) return null;
  if (/link de conex[aã]o inv[aá]lido|convite/i.test(error)) return INACTIVE_LINK_MESSAGE;
  return error;
}
