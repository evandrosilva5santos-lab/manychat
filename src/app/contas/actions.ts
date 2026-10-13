"use server";

import { revalidatePath } from "next/cache";
import { disconnectAccount } from "@/lib/meta/account-lifecycle";
import {
  AccountAccessError,
  clearActiveAccount,
  getTenantContext,
  requireActor,
  selectActiveAccount,
  setActiveAccount,
} from "@/lib/tenancy";

export type AccountActionResult = { ok: boolean; message: string };

const GENERIC_FAILURE = "Não foi possível concluir agora. Tente de novo em instantes.";

function failure(error: unknown): AccountActionResult {
  if (error instanceof AccountAccessError) return { ok: false, message: error.message };
  console.error("[contas] ação falhou", error instanceof Error ? error.name : "erro desconhecido");
  return { ok: false, message: GENERIC_FAILURE };
}

/** Torna a conta o perfil ativo. Revalida o acesso no servidor. */
export async function activateAccount(accountId: string): Promise<AccountActionResult> {
  try {
    if (!accountId) return { ok: false, message: "Perfil inválido." };
    const actor = await requireActor();
    const account = await selectActiveAccount(actor, accountId);
    await setActiveAccount(account.id);
    revalidatePath("/", "layout");
    return { ok: true, message: `@${account.username} agora é o perfil ativo.` };
  } catch (error) {
    return failure(error);
  }
}

/** "Descarregar perfil": desconecta o Instagram e mantém o histórico. */
export async function unloadAccount(accountId: string): Promise<AccountActionResult> {
  try {
    if (!accountId) return { ok: false, message: "Perfil inválido." };
    const actor = await requireActor();
    const account = await selectActiveAccount(actor, accountId);
    await disconnectAccount(account.id, { reason: "USER", notifyMeta: true });
    const tenant = await getTenantContext();
    if (tenant.account?.id === account.id) await clearActiveAccount();
    revalidatePath("/", "layout");
    return { ok: true, message: `@${account.username} foi descarregado. As automações dele estão paradas.` };
  } catch (error) {
    return failure(error);
  }
}
