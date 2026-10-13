export type AccountTone = "success" | "warning" | "danger" | "neutral";

/** Estado real do perfil em palavras (pt-BR). Nunca devolve o enum cru. */
export function accountStatusLabel(status: string | null | undefined): { label: string; tone: AccountTone } {
  switch (status) {
    case "CONNECTED":
      return { label: "Conectado", tone: "success" };
    case "EXPIRED":
      return { label: "Token expirado", tone: "warning" };
    case "DISCONNECTED":
      return { label: "Descarregado — automações paradas", tone: "danger" };
    default:
      return { label: "Estado desconhecido", tone: "neutral" };
  }
}

export function isAccountConnected(status: string | null | undefined): boolean {
  return status === "CONNECTED";
}

/** Texto de "Pausado" para automações ao vivo; null quando o perfil está conectado ou não existe. */
export function pausedFlowLabel(status: string | null | undefined): string | null {
  if (status === "EXPIRED") return "Pausado — token expirado";
  if (status === "DISCONNECTED") return "Pausado — perfil descarregado";
  return null;
}

/** Situação do token guardado para a conta (não a do .env). */
export function tokenStoredLabel(input: {
  status: string;
  tokenStatus: string | null;
  hasStoredToken: boolean;
}): string {
  if (input.status === "DISCONNECTED") return "Removido ao descarregar";
  if (input.status === "EXPIRED" || input.tokenStatus === "EXPIRED") return "Expirado";
  if (!input.hasStoredToken) return "Não guardado";
  return "Guardado e válido";
}

const BR_DATE = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

/** Validade do acesso em palavras. Data em fuso fixo para o servidor e o navegador mostrarem o mesmo dia. */
export function describeValidity(input: {
  authProvider: "INSTAGRAM_LOGIN" | "FACEBOOK_LOGIN";
  status: string;
  tokenExpiresAt: string | null;
}): string {
  const date = input.tokenExpiresAt ? BR_DATE.format(new Date(input.tokenExpiresAt)) : null;
  if (input.status === "DISCONNECTED") return "Sem acesso guardado";
  if (input.status === "EXPIRED") return date ? `Expirou em ${date}` : "Expirou";
  if (input.authProvider === "FACEBOOK_LOGIN") return "Não expira";
  return date ? `Renova sozinho até ${date}` : "Sem data de validade registrada";
}
