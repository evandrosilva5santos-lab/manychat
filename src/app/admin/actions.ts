"use server";

import { revalidatePath } from "next/cache";
import { graphClientForAccount } from "@/lib/meta/account-client";
import { createConnectInvite } from "@/lib/meta/connect-invite";
import { impersonateWorkspace, requireSuperAdmin } from "@/lib/tenancy";

export type AdminActionResult = {
  ok: boolean;
  error?: string;
  url?: string;
  message?: string;
};

function validId(value: string): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= 191;
}

/** Verifica a conexão da conta selecionada sem expor seu token ao navegador. */
export async function testAccountConnection(accountId: string): Promise<AdminActionResult> {
  await requireSuperAdmin();
  if (!validId(accountId)) return { ok: false, error: "Conta inválida." };

  try {
    const result = await (await graphClientForAccount(accountId)).validateConnection();
    if (!result.valid) return { ok: false, error: result.error || "A Meta recusou a validação desta conta." };

    return {
      ok: true,
      message: result.username ? `Conexão com @${result.username} validada.` : "Conexão validada.",
    };
  } catch (error) {
    console.error("[admin] Falha ao testar conexão", error);
    return { ok: false, error: "Não foi possível testar esta conexão agora." };
  }
}

/**
 * Prepara um link de WhatsApp para o operador enviar ao cliente. Não envia
 * mensagens nem revela tokens; a URL de destino é configurada pelo ambiente.
 */
export async function getReconnectWhatsAppLink(
  workspaceId: string,
  accountId: string,
  username: string,
): Promise<AdminActionResult> {
  await requireSuperAdmin();
  if (!validId(workspaceId) || !validId(accountId) || !username.trim()) {
    return { ok: false, error: "Dados da conta inválidos." };
  }

  const configuredUrl = process.env.ADMIN_RECONNECT_WHATSAPP_URL;
  if (!configuredUrl) {
    return { ok: false, error: "A URL de reconexão por WhatsApp não está configurada." };
  }
  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== "https:") throw new Error("insecure url");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) return { ok: false, error: "A URL pública do Fluxo não está configurada." };

    const appOrigin = new URL(appUrl);
    if (appOrigin.protocol !== "https:") throw new Error("insecure app url");
    // Convite assinado: sem ele a tela /conectar não sabe a qual cliente a conta pertence.
    const connectLink = new URL("/conectar", appOrigin);
    connectLink.searchParams.set("convite", createConnectInvite(workspaceId));
    const connectUrl = connectLink.toString();
    const text = `Olá! Reconecte a conta @${username.replace(/^@/, "")} ao instachat por este link seguro: ${connectUrl}`;
    url.searchParams.set("text", text);
    return { ok: true, url: url.toString() };
  } catch (error) {
    console.error("[admin] URL de WhatsApp inválida", error);
    return { ok: false, error: "A URL de reconexão por WhatsApp é inválida." };
  }
}

/** Inicia uma impersonação controlada para suporte e atualiza os dados da página. */
export async function viewWorkspaceAsClient(workspaceId: string): Promise<AdminActionResult> {
  await requireSuperAdmin();
  if (!validId(workspaceId)) return { ok: false, error: "Workspace inválido." };

  try {
    await impersonateWorkspace(workspaceId);
    revalidatePath("/");
    revalidatePath("/admin");
    return { ok: true, message: "Visão do cliente ativada." };
  } catch (error) {
    console.error("[admin] Falha ao iniciar impersonação", error);
    return { ok: false, error: "Não foi possível abrir a visão deste cliente." };
  }
}
