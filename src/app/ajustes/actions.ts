"use server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentAccount, listAllAccounts } from "@/lib/account";
import { graphClientForAccount } from "@/lib/meta/account-client";
import { createConnectInvite } from "@/lib/meta/connect-invite";
import {
  getAppBaseUrl,
  getFacebookAppCredentials,
  getInstagramAppCredentials,
  getInstagramRedirectUri,
  getOAuthSigningSecret,
} from "@/lib/meta/oauth";
import { clearActiveAccount, getOrCreateWorkspaceForActor, getTenantContext } from "@/lib/tenancy";

export type MetaSettingsData = {
  account: {
    id: string;
    username: string;
    name: string | null;
    igUserId: string;
    status: string;
    tokenExpiresAt?: string | null;
  } | null;
  hasAccessToken: boolean;
  hasAppSecret: boolean;
  webhookCallbackUrl: string;
  oauthRedirectUrl: string;
  oauthLoginUrl: string;
  /** Redirect URI absoluta que precisa estar cadastrada nos DOIS logins do painel da Meta. */
  oauthRedirectUri: string;
  /** Link do cliente com convite assinado (7 dias) para o workspace em uso; null se não der para gerar. */
  clientConnectUrl: string | null;
  /** Diagnóstico da configuração de cada login (nunca expõe segredos). */
  oauthConfig: { facebookIssue: string | null; instagramIssue: string | null; stateIssue: string | null };
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

/** Mensagem do erro de configuração, ou null quando está tudo certo. */
function configIssue(check: () => unknown): string | null {
  try {
    check();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Configuração inválida.";
  }
}

/** Convite para o workspace em uso (o do cliente que o superadmin está vendo, ou o próprio). */
async function buildClientConnectUrl(): Promise<string | null> {
  try {
    const { actor, impersonatedWorkspaceId } = await getTenantContext();
    if (!actor) return null;
    const workspaceId = impersonatedWorkspaceId ?? (await getOrCreateWorkspaceForActor(actor)).id;
    const url = new URL("/conectar", getAppBaseUrl());
    url.searchParams.set("convite", createConnectInvite(workspaceId));
    return url.toString();
  } catch (error) {
    console.error("[ajustes] Não foi possível gerar o link do cliente", error instanceof Error ? error.message : error);
    return null;
  }
}
const META_UNAVAILABLE = "Não foi possível falar com a Meta agora. Tente novamente em instantes.";

/**
 * Desconecta apenas o perfil ativo. O histórico, fluxos e contatos continuam
 * no banco; a credencial local é removida para impedir novos envios.
 */
export async function disconnectCurrentInstagramProfile(): Promise<{ ok: boolean; error?: string }> {
  await requireAuth();
  const account = await getCurrentAccount();
  if (!account) return { ok: false, error: "Nenhum perfil do Instagram está carregado." };

  await prisma.instagramAccount.update({
    where: { id: account.id },
    data: { status: "DISCONNECTED", tokenStatus: "REVOKED", accessTokenEnc: null, tokenExpiresAt: null },
  });
  await clearActiveAccount();
  revalidatePath("/", "layout");
  revalidatePath("/ajustes");
  return { ok: true };
}

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

  const hasAccessToken = Boolean(account?.accessTokenEnc || process.env.IG_ACCESS_TOKEN);
  const hasAppSecret = Boolean(process.env.META_APP_SECRET || process.env.IG_APP_SECRET);
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;

  return {
    account: account ? {
      id: account.id,
      username: account.username,
      name: account.name,
      igUserId: account.igUserId,
      status: account.status,
      tokenExpiresAt: account.tokenExpiresAt ? account.tokenExpiresAt.toISOString() : null,
    } : null,
    hasAccessToken,
    hasAppSecret,
    webhookCallbackUrl: "/api/webhook/instagram",
    oauthRedirectUrl: "/api/auth/instagram/callback",
    oauthLoginUrl: "/api/auth/instagram/login",
    oauthRedirectUri: getInstagramRedirectUri(),
    clientConnectUrl: await buildClientConnectUrl(),
    oauthConfig: {
      facebookIssue: configIssue(getFacebookAppCredentials),
      instagramIssue: configIssue(getInstagramAppCredentials),
      stateIssue: configIssue(getOAuthSigningSecret),
    },
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
    const account = await getCurrentAccount();
    if (!account) return { ok: false, error: "Nenhuma conta do Instagram está selecionada." };
    const res = await (await graphClientForAccount(account.id)).validateConnection();
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
    const account = await getCurrentAccount();
    if (!account) return { ok: false, error: "Nenhuma conta do Instagram está selecionada." };
    const res = await (await graphClientForAccount(account.id)).refreshLongLivedToken();
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
    if (!account) return { ok: false, error: "Nenhuma conta do Instagram está selecionada." };
    const res = await (await graphClientForAccount(account.id)).subscribeWebhooks(account.igUserId);
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
