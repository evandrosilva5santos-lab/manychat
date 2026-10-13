"use server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentAccount, listAllAccounts } from "@/lib/account";
import { graphClientForAccount } from "@/lib/meta/account-client";
import { createConnectInvite } from "@/lib/meta/connect-invite";
import { disconnectAccount, requestAccountDeletion } from "@/lib/meta/account-lifecycle";
import { matchesConfirmation } from "@/components/ui/confirm-match";
import { decryptToken, encryptToken } from "@/lib/security/token";
import {
  MetaTokenError,
  refreshInstagramLongLivedToken,
  getAppBaseUrl,
  getFacebookAppCredentials,
  getInstagramAppCredentials,
  getInstagramRedirectUri,
  getOAuthSigningSecret,
} from "@/lib/meta/oauth";
import {
  clearActiveAccount,
  findNextConnectedAccount,
  getOrCreateWorkspaceForActor,
  getTenantContext,
  requireSuperAdmin,
  requireWorkspaceRole,
  AccountAccessError,
  MANAGER_ROLES,
  type WorkspaceRole,
  setActiveAccount,
} from "@/lib/tenancy";

export type MetaSettingsData = {
  account: {
    id: string;
    username: string;
    name: string | null;
    igUserId: string;
    status: string;
    tokenStatus: string | null;
    tokenExpiresAt: string | null;
    authProvider: "INSTAGRAM_LOGIN" | "FACEBOOK_LOGIN";
    /** Há token guardado para ESTA conta (o token em si nunca vai ao navegador). */
    hasStoredToken: boolean;
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
    authProvider: "INSTAGRAM_LOGIN" | "FACEBOOK_LOGIN";
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

/** Mensagem de erro se a pessoa não tiver um dos papéis no workspace; `null` se tiver. */
async function roleProblem(workspaceId: string, allowed: readonly WorkspaceRole[]): Promise<string | null> {
  try {
    await requireWorkspaceRole(workspaceId, allowed);
    return null;
  } catch (error) {
    if (error instanceof AccountAccessError) return error.message;
    throw error;
  }
}

/** Convite para o workspace em uso (o do cliente que o superadmin está vendo, ou o próprio). Só OWNER/ADMIN geram. */
async function buildClientConnectUrl(): Promise<string | null> {
  try {
    const { actor, impersonatedWorkspaceId } = await getTenantContext();
    if (!actor) return null;
    const workspaceId = impersonatedWorkspaceId ?? (await getOrCreateWorkspaceForActor(actor)).id;
    if (await roleProblem(workspaceId, MANAGER_ROLES)) return null;
    const url = new URL("/conectar", getAppBaseUrl());
    url.searchParams.set("convite", createConnectInvite(workspaceId));
    return url.toString();
  } catch (error) {
    console.error("[ajustes] Não foi possível gerar o link do cliente", error instanceof Error ? error.message : error);
    return null;
  }
}
const META_UNAVAILABLE = "Não foi possível falar com a Meta agora. Tente novamente em instantes.";

const NO_PROFILE = "Nenhum perfil do Instagram está carregado.";
const DISCONNECT_FAILED = "Não foi possível descarregar o perfil agora. Tente novamente em instantes.";
const DELETE_FAILED = "Não foi possível excluir o perfil agora. Tente novamente em instantes.";
const PROFILE_CHANGED = "O perfil ativo mudou. Recarregue a página e tente de novo.";
const NAME_MISMATCH = "O nome digitado não confere com o perfil.";

/**
 * Depois de descarregar/excluir: ativa outro perfil CONECTADO do MESMO workspace
 * (nunca de outro cliente) ou limpa a seleção. Revalida o layout e Ajustes.
 */
async function moveToNextAccount(current: { id: string; workspaceId: string }): Promise<string | null> {
  const next = await findNextConnectedAccount(current.workspaceId, current.id);
  if (next) await setActiveAccount(next.id);
  else await clearActiveAccount();
  revalidatePath("/", "layout");
  revalidatePath("/ajustes");
  return next?.id ?? null;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.name === "AccountAccessError" ? error.message : fallback;
}

/**
 * Descarrega o perfil ativo. O id vindo do navegador só é COMPARADO com o perfil
 * ativo (nunca usado como alvo): evita descarregar o perfil errado se a seleção
 * mudou em outra aba. A Meta é avisada em best-effort; histórico, fluxos e
 * contatos continuam guardados.
 */
export async function disconnectCurrentInstagramProfile(expectedAccountId: string): Promise<{
  ok: boolean;
  error?: string;
  nextAccountId?: string | null;
}> {
  await requireAuth();
  const account = await getCurrentAccount();
  if (!account) return { ok: false, error: NO_PROFILE };
  if (typeof expectedAccountId !== "string" || expectedAccountId !== account.id) {
    return { ok: false, error: PROFILE_CHANGED };
  }

  try {
    const denied = await roleProblem(account.workspaceId, MANAGER_ROLES);
    if (denied) return { ok: false, error: denied };
    await disconnectAccount(account.id, { reason: "USER", notifyMeta: true });
    return { ok: true, nextAccountId: await moveToNextAccount(account) };
  } catch (error) {
    console.error("[ajustes] Falha ao descarregar perfil", error instanceof Error ? error.message : error);
    return { ok: false, error: DISCONNECT_FAILED };
  }
}

/**
 * Exclui o perfil ativo e seus dados. A confirmação do @ é conferida AQUI,
 * no servidor; durante "ver como cliente" só o SUPERADMIN pode excluir.
 */
export async function deleteCurrentInstagramProfile(confirmation: string): Promise<{
  ok: boolean;
  error?: string;
  status?: "PENDING" | "COMPLETED" | "FAILED";
  code?: string;
}> {
  await requireAuth();
  try {
    const context = await getTenantContext();
    if (context.impersonatedWorkspaceId) await requireSuperAdmin();

    const account = await getCurrentAccount();
    if (!account) return { ok: false, error: NO_PROFILE };
    // Excluir dados é irreversível: só o dono do workspace (ou o Super Admin).
    const denied = await roleProblem(account.workspaceId, ["OWNER"]);
    if (denied) return { ok: false, error: denied };
    if (typeof confirmation !== "string" || !matchesConfirmation(confirmation, account.username)) {
      return { ok: false, error: NAME_MISMATCH };
    }

    const result = await requestAccountDeletion(account.id, { actorId: context.actor?.id });
    await moveToNextAccount(account);
    if (result.status === "FAILED") {
      return { ok: false, status: result.status, code: result.code, error: DELETE_FAILED };
    }
    return { ok: true, status: result.status, code: result.code };
  } catch (error) {
    console.error("[ajustes] Falha ao excluir perfil", error instanceof Error ? error.message : error);
    return { ok: false, error: errorMessage(error, DELETE_FAILED) };
  }
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

  const hasAccessToken = Boolean(account?.accessTokenEnc);
  const hasAppSecret = Boolean(process.env.META_APP_SECRET || process.env.IG_APP_SECRET);
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;

  return {
    account: account ? {
      id: account.id,
      username: account.username,
      name: account.name,
      igUserId: account.igUserId,
      status: account.status,
      tokenStatus: account.tokenStatus ?? null,
      tokenExpiresAt: account.tokenExpiresAt ? account.tokenExpiresAt.toISOString() : null,
      authProvider: account.authProvider,
      hasStoredToken: hasAccessToken,
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
    isMockMode: !(hasAccessToken || process.env.IG_ACCESS_TOKEN),
    allAccounts: allDbAccounts.map((a) => ({
      id: a.id,
      username: a.username,
      name: a.name,
      igUserId: a.igUserId,
      status: a.status,
      authProvider: a.authProvider,
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
 * Renova o token de 60 dias do Instagram e SALVA o novo token (criptografado).
 * Facebook usa token de Página, que não expira: nada a renovar.
 */
export async function renewMetaToken(): Promise<{
  ok: boolean;
  expiresInDays?: number;
  message?: string;
  error?: string;
}> {
  await requireAuth();
  try {
    const account = await getCurrentAccount();
    if (!account) return { ok: false, error: "Nenhuma conta do Instagram está selecionada." };
    if (account.authProvider === "FACEBOOK_LOGIN") {
      return { ok: true, message: "Conta do Facebook usa token de Página, que não expira." };
    }
    if (!account.accessTokenEnc) {
      return { ok: false, error: "Este perfil não tem token guardado. Clique em Carregar perfil de novo." };
    }

    const { accessToken, expiresIn } = await refreshInstagramLongLivedToken(decryptToken(account.accessTokenEnc));
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const saved = await prisma.instagramAccount.updateMany({
      where: { id: account.id, status: "CONNECTED" },
      data: { accessTokenEnc: encryptToken(accessToken), tokenExpiresAt: expiresAt, tokenStatus: "ACTIVE" },
    });
    if (saved.count === 0) {
      return { ok: false, error: "O perfil não está mais conectado. Clique em Carregar perfil de novo." };
    }
    revalidatePath("/ajustes");
    return { ok: true, expiresInDays: Math.round(expiresIn / 86400) };
  } catch (err) {
    if (err instanceof MetaTokenError && err.isPermanent) {
      return { ok: false, error: "A Meta recusou renovar o acesso. Clique em Carregar perfil de novo e entre com o Instagram." };
    }
    console.error("[ajustes] Falha ao renovar token", err instanceof Error ? err.message : err);
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
  try {
    await requireSuperAdmin();
  } catch {
    return { ok: false, error: "Apenas o Super Admin pode ver o token de verificação." };
  }
  const token = process.env.WEBHOOK_VERIFY_TOKEN;
  if (!token) {
    return { ok: false, error: "WEBHOOK_VERIFY_TOKEN não está configurado." };
  }
  return { ok: true, token };
}
