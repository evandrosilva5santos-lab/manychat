// Plano e uso do workspace lidos do banco (ADR-008). As regras ficam em plan-rules.ts.
import { prisma } from "@/lib/prisma";
import { checkLimit, computeEntitlements, LIMIT_LABELS, type Entitlements, type LimitKey, type SubscriptionLike } from "./plan-rules";

export type Usage = Record<LimitKey, number>;

/** Início do mês corrente em UTC: a janela das mensagens contadas no plano. */
export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getEntitlements(workspaceId: string, now = new Date()): Promise<Entitlements> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { kind: true, subscription: { include: { plan: true } } },
  });
  if (!workspace) return computeEntitlements({ kind: "CUSTOMER", subscription: null }, now);
  return computeEntitlements({ kind: workspace.kind, subscription: workspace.subscription as SubscriptionLike | null }, now);
}

const counters: Record<LimitKey, (workspaceId: string, now: Date) => Promise<number>> = {
  // Perfil descarregado não ocupa vaga: descarregar libera espaço para outro.
  maxInstagramAccounts: (workspaceId) =>
    prisma.instagramAccount.count({ where: { workspaceId, status: { not: "DISCONNECTED" } } }),
  maxMembers: (workspaceId) => prisma.workspaceMember.count({ where: { workspaceId } }),
  maxActiveFlows: (workspaceId) =>
    prisma.flow.count({ where: { status: "LIVE", archivedAt: null, account: { workspaceId } } }),
  maxDmsPerMonth: (workspaceId, now) =>
    prisma.message.count({
      where: { direction: "OUT", error: null, createdAt: { gte: monthStart(now) }, account: { workspaceId } },
    }),
};

export async function countUsage(workspaceId: string, key: LimitKey, now = new Date()): Promise<number> {
  return counters[key](workspaceId, now);
}

export async function getUsage(workspaceId: string, now = new Date()): Promise<Usage> {
  const keys = Object.keys(counters) as LimitKey[];
  const values = await Promise.all(keys.map((key) => counters[key](workspaceId, now)));
  return Object.fromEntries(keys.map((key, index) => [key, values[index]])) as Usage;
}

/** Lança `PlanLimitError` (mensagem para o cliente) se `adding` itens a mais passarem do plano. */
export async function assertWithinLimit(workspaceId: string, key: LimitKey, adding = 1): Promise<void> {
  const entitlements = await getEntitlements(workspaceId);
  if (entitlements.kind === "INTERNAL") return;
  checkLimit(entitlements, key, await countUsage(workspaceId, key), adding);
}

/** Convites pendentes também ocupam vaga, para o limite não estourar no aceite. */
export async function assertCanAddMember(workspaceId: string): Promise<void> {
  const entitlements = await getEntitlements(workspaceId);
  if (entitlements.kind === "INTERNAL") return;
  const [members, pending] = await Promise.all([
    countUsage(workspaceId, "maxMembers"),
    prisma.workspaceInvitation.count({ where: { workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } } }),
  ]);
  checkLimit(entitlements, "maxMembers", members + pending);
}

/**
 * Motivo para o motor NÃO enviar mensagem por esta conta, ou `null`.
 * Assinatura bloqueada ou cota de mensagens do mês esgotada param os envios;
 * o webhook continua gravando contatos e mensagens recebidas.
 */
export async function sendingBlockReason(accountId: string): Promise<string | null> {
  const account = await prisma.instagramAccount.findUnique({ where: { id: accountId }, select: { workspaceId: true } });
  if (!account) return "Perfil não encontrado.";
  const entitlements = await getEntitlements(account.workspaceId);
  if (entitlements.kind === "INTERNAL") return null;
  if (!entitlements.canOperate) return entitlements.blockReason;
  const limit = entitlements.limits.maxDmsPerMonth;
  if (limit === null) return null;
  const sent = await countUsage(account.workspaceId, "maxDmsPerMonth");
  return sent >= limit ? `Limite de ${limit} ${LIMIT_LABELS.maxDmsPerMonth} do plano atingido.` : null;
}
