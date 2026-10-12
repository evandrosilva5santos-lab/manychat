/**
 * Convite de conexão do cliente.
 *
 * Link assinado que a agência envia ao cliente para ele conectar o Instagram
 * direto em um workspace específico, sem precisar ter sessão no painel.
 * Formato: base64url({ w, exp }) + "." + HMAC("invite:" + base64url).
 * O domínio "invite" impede que um state OAuth valha como convite (e vice-versa).
 */
import { z } from "zod";
import { decodeBase64UrlJson, hasValidDomainSignature, signWithDomain, splitSignedToken } from "./oauth";

const INVITE_DOMAIN = "invite";
const DEFAULT_INVITE_TTL_MS = 7 * 86_400_000;

const invitePayloadSchema = z.object({
  w: z.string().min(1),
  exp: z.number().int().positive(),
});

/** Gera o token do convite para o workspace (padrão: vale 7 dias). */
export function createConnectInvite(workspaceId: string, now = Date.now(), ttlMs = DEFAULT_INVITE_TTL_MS): string {
  if (!workspaceId.trim()) {
    throw new Error("Workspace obrigatório para gerar o convite de conexão.");
  }
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error("Validade do convite precisa ser positiva.");
  }
  const payload = invitePayloadSchema.parse({ w: workspaceId, exp: Math.floor(now + ttlMs) });
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signWithDomain(INVITE_DOMAIN, body)}`;
}

/**
 * Valida o convite. Retorna null para token ausente, adulterado, expirado ou
 * que seja de outro tipo (ex.: state OAuth). Sem segredo, lança OAuthConfigError.
 */
export function readConnectInvite(token: string | null | undefined, now = Date.now()): { workspaceId: string } | null {
  if (!token) return null;
  const parts = splitSignedToken(token);
  if (!parts) return null;
  if (!hasValidDomainSignature(INVITE_DOMAIN, parts.body, parts.signature)) return null;

  const parsed = invitePayloadSchema.safeParse(decodeBase64UrlJson(parts.body));
  if (!parsed.success || parsed.data.exp <= now) return null;
  return { workspaceId: parsed.data.w };
}
