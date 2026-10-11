"use server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { revalidatePath } from "next/cache";
import { getCurrentAccount, listAllAccounts } from "@/lib/account";
import { defaultGraphClient } from "@/lib/meta/graph";

export type MetaSettingsData = {
  account: {
    id: string;
    username: string;
    name: string | null;
    igUserId: string;
    status: string;
    tokenExpiresAt?: string | null;
  };
  hasAccessToken: boolean;
  hasAppSecret: boolean;
  webhookCallbackUrl: string;
  oauthRedirectUrl: string;
  oauthLoginUrl: string;
  /** O token em si nunca vai para o navegador; só se está configurado e uma dica. */
  webhookVerifyTokenConfigured: boolean;
  webhookVerifyTokenHint: string | null;
  isMockMode: boolean;
  allAccounts: Array<{
    id: string;
    username: string;
    name: string | null;
    igUserId: string;
    status: string;
    tokenExpiresAt: string | null;
  }>;
};

const TOKEN_HINT_VISIBLE_CHARS = 3;
const META_UNAVAILABLE = "Não foi possível falar com a Meta agora. Tente novamente em instantes.";

function maskSecret(value: string | undefined): string | null {
  if (!value) return null;
  return `${value.slice(0, TOKEN_HINT_VISIBLE_CHARS)}${"•".repeat(8)}`;
}

/**
 * Retorna o status atual da conexão com a Meta e as credenciais configuradas.
 */
export async function getMetaSettings(): Promise<MetaSettingsData> {
  await requireAuth();
  const account = await getCurrentAccount();
  const allDbAccounts = await listAllAccounts();

  const hasAccessToken = Boolean(account.accessTokenEnc || process.env.IG_ACCESS_TOKEN);
  const hasAppSecret = Boolean(process.env.META_APP_SECRET || process.env.IG_APP_SECRET);
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;

  return {
    account: {
      id: account.id,
      username: account.username,
      name: account.name,
      igUserId: account.igUserId,
      status: account.status,
      tokenExpiresAt: account.tokenExpiresAt ? account.tokenExpiresAt.toISOString() : null,
    },
    hasAccessToken,
    hasAppSecret,
    webhookCallbackUrl: "/api/webhook/instagram",
    oauthRedirectUrl: "/api/auth/instagram/callback",
    oauthLoginUrl: "/api/auth/instagram/login",
    webhookVerifyTokenConfigured: Boolean(verifyToken),
    webhookVerifyTokenHint: maskSecret(verifyToken),
    isMockMode: !hasAccessToken,
    allAccounts: allDbAccounts.map((a) => ({
      id: a.id,
      username: a.username,
      name: a.name,
      igUserId: a.igUserId,
      status: a.status,
      tokenExpiresAt: a.tokenExpiresAt ? a.tokenExpiresAt.toISOString() : null,
    })),
  };
}

/**
 * Executa uma chamada de teste na Graph API da Meta para validar o token.
 */
export async function testMetaConnection(): Promise<{
  ok: boolean;
  username?: string;
  name?: string;
  igUserId?: string;
  mock?: boolean;
  error?: string;
}> {
  await requireAuth();
  try {
    const res = await defaultGraphClient.validateConnection();
    if (res.valid) {
      return {
        ok: true,
        username: res.username,
        name: res.name,
        igUserId: res.igUserId,
        mock: res.mock,
      };
    }
    return { ok: false, error: res.error };
  } catch (err) {
    console.error("[ajustes] Falha na chamada à Meta", err);
    return { ok: false, error: META_UNAVAILABLE };
  }
}

/**
 * Renova o token de acesso de 60 dias (Long-Lived Token da Meta).
 */
export async function renewMetaToken(): Promise<{
  ok: boolean;
  expiresInDays?: number;
  error?: string;
}> {
  await requireAuth();
  try {
    const res = await defaultGraphClient.refreshLongLivedToken();
    if (res.success) {
      const days = res.expiresIn ? Math.round(res.expiresIn / 86400) : 60;
      revalidatePath("/ajustes");
      return { ok: true, expiresInDays: days };
    }
    return { ok: false, error: res.error };
  } catch (err) {
    console.error("[ajustes] Falha na chamada à Meta", err);
    return { ok: false, error: META_UNAVAILABLE };
  }
}

/**
 * Inscreve automaticamente os campos de webhook (comments e messages) na Meta.
 */
export async function subscribeMetaWebhooks(): Promise<{
  ok: boolean;
  error?: string;
}> {
  await requireAuth();
  try {
    const account = await getCurrentAccount();
    const res = await defaultGraphClient.subscribeWebhooks(account.igUserId);
    if (res.success) {
      revalidatePath("/ajustes");
      return { ok: true };
    }
    return { ok: false, error: res.error };
  } catch (err) {
    console.error("[ajustes] Falha na chamada à Meta", err);
    return { ok: false, error: META_UNAVAILABLE };
  }
}

/**
 * Retorna o token de verificação real para o admin autenticado poder copiar ou colar no painel da Meta.
 */
export async function revealWebhookVerifyToken(): Promise<{
  ok: boolean;
  token?: string;
  error?: string;
}> {
  await requireAuth();
  const token = process.env.WEBHOOK_VERIFY_TOKEN;
  if (!token) {
    return { ok: false, error: "WEBHOOK_VERIFY_TOKEN não está configurado." };
  }
  return { ok: true, token };
}
