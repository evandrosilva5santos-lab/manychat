// Erros que podem ser mostrados ao usuário. Qualquer outro erro (banco, rede,
// bug) vira um texto genérico: a mensagem interna fica só no log do servidor.
// Sem dependências: também é usado por código que roda no navegador.

/** Erro com mensagem escrita para o usuário final (pt-BR, sem detalhe técnico). */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

/** Mensagem segura para devolver numa Server Action. */
export function actionErrorMessage(error: unknown, fallback: string): string {
  return error instanceof UserFacingError ? error.message : fallback;
}
