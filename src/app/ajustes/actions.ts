"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAccount } from "@/lib/account";
import { defaultGraphClient } from "@/lib/meta/graph";
import { prisma } from "@/lib/prisma";

export type MetaSettingsData = {
  account: {
    id: string;
    username: string;
    name: string | null;
    igUserId: string;
    status: string;
  };
  hasAccessToken: boolean;
  hasAppSecret: boolean;
  webhookCallbackUrl: string;
  webhookVerifyToken: string;
  isMockMode: boolean;
};

/**
 * Retorna o status atual da conexão com a Meta e as credenciais configuradas.
 */
export async function getMetaSettings(): Promise<MetaSettingsData> {
  const account = await getCurrentAccount();
  const hasAccessToken = Boolean(process.env.IG_ACCESS_TOKEN);
  const hasAppSecret = Boolean(process.env.META_APP_SECRET || process.env.IG_APP_SECRET);
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || "token_verificacao_manychat_secreto";

  return {
    account: {
      id: account.id,
      username: account.username,
      name: account.name,
      igUserId: account.igUserId,
      status: account.status,
    },
    hasAccessToken,
    hasAppSecret,
    webhookCallbackUrl: "/api/webhook/instagram",
    webhookVerifyToken: verifyToken,
    isMockMode: !hasAccessToken,
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
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
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
  try {
    const res = await defaultGraphClient.refreshLongLivedToken();
    if (res.success) {
      const days = res.expiresIn ? Math.round(res.expiresIn / 86400) : 60;
      revalidatePath("/ajustes");
      return { ok: true, expiresInDays: days };
    }
    return { ok: false, error: res.error };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Inscreve automaticamente os campos de webhook (comments e messages) na Meta.
 */
export async function subscribeMetaWebhooks(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const account = await getCurrentAccount();
    const res = await defaultGraphClient.subscribeWebhooks(account.igUserId);
    if (res.success) {
      revalidatePath("/ajustes");
      return { ok: true };
    }
    return { ok: false, error: res.error };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}
