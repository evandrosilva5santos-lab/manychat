import { prisma } from "@/lib/prisma";
import type { InstagramAccount } from "@/generated/prisma/client";
import { getCurrentActor, getTenantContext, listAccessibleAccounts, selectActiveAccount } from "@/lib/tenancy";

/**
 * Conta ativa da sessão. Não cria conta de demonstração nem escolhe a primeira
 * conta do banco: as duas opções violariam o isolamento entre clientes.
 */
export async function getCurrentAccount(): Promise<InstagramAccount | null> {
  return (await getTenantContext()).account;
}

/** Listagem limitada às contas pertencentes ao usuário atual. */
export async function listAllAccounts(): Promise<InstagramAccount[]> {
  const actor = await getCurrentActor();
  return actor ? listAccessibleAccounts(actor) : [];
}

export async function getAccessibleAccount(accountId: string): Promise<InstagramAccount | null> {
  const actor = await getCurrentActor();
  if (!actor) return null;
  try {
    return await selectActiveAccount(actor, accountId);
  } catch {
    return null;
  }
}

export async function countConnectedAccounts() {
  return prisma.instagramAccount.count({ where: { status: "CONNECTED" } });
}
