import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/security/token";
import { errorCode } from "@/lib/log-safe";
import { GRAPH_API_VERSION } from "./graph";

export type DisconnectReason = "USER" | "META_DEAUTHORIZE" | "META_DATA_DELETION";
type DeletionStatus = "PENDING" | "COMPLETED" | "FAILED";

const META_TIMEOUT_MS = 10_000;
const BATCH_SIZE = 5000;
const DEFAULT_BUDGET_MS = 40_000;
const MAX_ATTEMPTS = 5;
const STALE_PENDING_MS = 5 * 60 * 1000;
const ACTIVE_RUN_STATUSES = ["RUNNING", "WAITING_REPLY", "WAITING_DELAY", "WAITING_CLICK"] as const;

type AccountForMeta = { id: string; authProvider: string; fbPageId: string | null; accessTokenEnc: string | null };

/** Cancela a assinatura de webhooks na Meta. Melhor esforço: só avisa em caso de falha. */
async function cancelMetaSubscription(account: AccountForMeta): Promise<void> {
  if (!account.accessTokenEnc) return;
  try {
    const token = decryptToken(account.accessTokenEnc);
    const signal = AbortSignal.timeout(META_TIMEOUT_MS);
    let res: Response;
    if (account.authProvider === "FACEBOOK_LOGIN") {
      if (!account.fbPageId) return;
      res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${account.fbPageId}/subscribed_apps`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
    } else {
      res = await fetch(`https://graph.instagram.com/${GRAPH_API_VERSION}/me/subscribed_apps`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
    }
    if (!res.ok) console.warn(`[lifecycle] cancelar assinatura na Meta falhou (HTTP ${res.status}) conta=${account.id}`);
  } catch (err) {
    console.warn(`[lifecycle] cancelar assinatura na Meta falhou (${errorCode(err)}) conta=${account.id}`);
  }
}

/** Descarrega o perfil: remove a credencial e encerra execuções ativas. Idempotente. */
export async function disconnectAccount(
  accountId: string,
  opts: { reason: DisconnectReason; notifyMeta: boolean },
): Promise<void> {
  const account = await prisma.instagramAccount.findUnique({
    where: { id: accountId },
    select: { id: true, authProvider: true, fbPageId: true, accessTokenEnc: true },
  });
  if (!account) return;

  if (opts.notifyMeta) await cancelMetaSubscription(account);

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.instagramAccount.update({
      where: { id: accountId },
      data: { status: "DISCONNECTED", tokenStatus: "REVOKED", accessTokenEnc: null, tokenExpiresAt: null },
    });
    await tx.flowRun.updateMany({
      where: { flow: { accountId }, status: { in: [...ACTIVE_RUN_STATUSES] } },
      data: { status: "FAILED", error: "Perfil descarregado", finishedAt: now },
    });
  });
}

/** "Excluir perfil e dados" no app. */
export async function requestAccountDeletion(
  accountId: string,
  opts: { actorId?: string },
): Promise<{ code: string; status: DeletionStatus }> {
  const account = await prisma.instagramAccount.findUnique({
    where: { id: accountId },
    select: { authProvider: true },
  });
  await disconnectAccount(accountId, { reason: "USER", notifyMeta: true });

  const code = randomBytes(16).toString("base64url");
  const request = await prisma.dataDeletionRequest.create({
    data: {
      source: "APP",
      scope: "BUSINESS",
      provider: account?.authProvider ?? null,
      requestKey: `app:${accountId}:${Date.now()}`,
      code,
      accountIds: [accountId],
    },
  });
  console.info(`[lifecycle] exclusão solicitada pedido=${request.id} ator=${opts.actorId ?? "desconhecido"}`);

  const status = await runDeletion(request.id, { budgetMs: 25_000 });
  return { code, status };
}

type BatchDelegate = {
  findMany: (args: { where: unknown; select: { id: true }; take: number }) => Promise<Array<{ id: string }>>;
  deleteMany: (args: { where: { id: { in: string[] } } }) => Promise<unknown>;
};

/** Apaga em lotes até esvaziar. Retorna false se o tempo acabou antes. */
async function deleteInBatches(delegate: BatchDelegate, where: unknown, deadline: number): Promise<boolean> {
  for (;;) {
    if (Date.now() >= deadline) return false;
    const rows = await delegate.findMany({ where, select: { id: true }, take: BATCH_SIZE });
    if (rows.length === 0) return true;
    await delegate.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
    if (rows.length < BATCH_SIZE) return true;
  }
}

/** Retorna false se o tempo acabou; true se a conta (se existia) foi removida. */
async function deleteBusinessData(accountId: string, igUserId: string, deadline: number): Promise<boolean> {
  const steps: Array<[BatchDelegate, unknown]> = [
    [prisma.message as unknown as BatchDelegate, { accountId }],
    [prisma.flowRun as unknown as BatchDelegate, { flow: { accountId } }],
    [prisma.contact as unknown as BatchDelegate, { accountId }],
    [prisma.webhookEvent as unknown as BatchDelegate, { accountId }],
    [prisma.webhookEvent as unknown as BatchDelegate, { accountId: null, idempotencyKey: { startsWith: `ig:${igUserId}:` } }],
  ];
  for (const [delegate, where] of steps) {
    if (!(await deleteInBatches(delegate, where, deadline))) return false;
  }
  await prisma.$transaction(
    async (tx) => {
      // CarouselCard -> CatalogItem é ON DELETE RESTRICT: os cards saem primeiro.
      await tx.carouselCard.deleteMany({
        where: { OR: [{ node: { flow: { accountId } } }, { catalogItem: { accountId } }] },
      });
      await tx.flow.deleteMany({ where: { accountId } });
      await tx.catalogItem.deleteMany({ where: { accountId } });
      await tx.tag.deleteMany({ where: { accountId } });
      await tx.trackedLink.deleteMany({ where: { accountId } });
      await tx.privateReply.deleteMany({ where: { accountId } });
      await tx.instagramAccount.deleteMany({ where: { id: accountId } });
    },
    { timeout: 15_000 },
  );
  return true;
}

export async function runDeletion(
  requestId: string,
  opts?: { budgetMs?: number },
): Promise<DeletionStatus> {
  const request = await prisma.dataDeletionRequest.findUnique({ where: { id: requestId } });
  if (!request) return "FAILED";
  if (request.status !== "PENDING") return request.status as DeletionStatus;

  const deadline = Date.now() + (opts?.budgetMs ?? DEFAULT_BUDGET_MS);
  try {
    let found = 0;
    let finished = true;
    for (const accountId of request.accountIds) {
      const account = await prisma.instagramAccount.findUnique({
        where: { id: accountId },
        select: { id: true, igUserId: true, connectedAt: true },
      });
      if (!account) continue;
      // Quem reconectou depois de pedir a exclusão não perde a nova conexão.
      if (
        request.source === "META_CALLBACK" &&
        account.connectedAt &&
        account.connectedAt.getTime() > request.createdAt.getTime()
      ) {
        continue;
      }
      found += 1;
      if (request.scope === "PERSON") {
        await disconnectAccount(accountId, { reason: "META_DATA_DELETION", notifyMeta: false });
        await prisma.instagramAccount.update({ where: { id: accountId }, data: { metaUserId: null } });
      } else if (!(await deleteBusinessData(accountId, account.igUserId, deadline))) {
        finished = false;
        break;
      }
    }
    // Orçamento esgotado é progresso, não falha: não soma tentativa.
    if (!finished) return "PENDING";
    await prisma.dataDeletionRequest.update({
      where: { id: requestId },
      data: { status: "COMPLETED", accountsAffected: found, completedAt: new Date() },
    });
    return "COMPLETED";
  } catch (err) {
    const attempts = request.attempts + 1;
    const status: DeletionStatus = attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING";
    console.error(`[lifecycle] exclusão falhou pedido=${requestId} motivo=${errorCode(err)}`);
    try {
      await prisma.dataDeletionRequest.update({
        where: { id: requestId },
        data: { attempts: { increment: 1 }, lastError: errorCode(err), status },
      });
    } catch {
      /* já registrado acima */
    }
    return status;
  }
}

/** Retoma pedidos pendentes parados (rede de segurança chamada pelos crons). */
export async function resumePendingDeletions(opts?: { budgetMs?: number }): Promise<{ resumed: number }> {
  const deadline = Date.now() + (opts?.budgetMs ?? DEFAULT_BUDGET_MS);
  const cutoff = new Date(Date.now() - STALE_PENDING_MS);
  const pending = await prisma.dataDeletionRequest.findMany({
    where: { status: "PENDING", OR: [{ createdAt: { lt: cutoff } }, { attempts: { gt: 0 } }] },
    orderBy: { createdAt: "asc" },
    select: { id: true },
    take: 20,
  });
  let resumed = 0;
  for (const { id } of pending) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await runDeletion(id, { budgetMs: remaining });
    resumed += 1;
  }
  return { resumed };
}

const MAX_CALLBACK_MATCHES = 20;

/**
 * Contas atingidas por um callback assinado da Meta. Descarta contas
 * conectadas depois da emissão do pedido. Retorna null se houver mais de 20
 * (nada deve ser feito nesse caso).
 */
export async function findAccountsForCallback(data: {
  provider: "INSTAGRAM_LOGIN" | "FACEBOOK_LOGIN";
  userId: string;
  issuedAt: Date;
}): Promise<string[] | null> {
  const where =
    data.provider === "INSTAGRAM_LOGIN"
      ? { authProvider: "INSTAGRAM_LOGIN" as const, OR: [{ metaUserId: data.userId }, { igUserId: data.userId }] }
      : { authProvider: "FACEBOOK_LOGIN" as const, metaUserId: data.userId };
  const accounts = await prisma.instagramAccount.findMany({
    where,
    select: { id: true, connectedAt: true },
    take: MAX_CALLBACK_MATCHES + 1,
  });
  if (accounts.length > MAX_CALLBACK_MATCHES) return null;
  return accounts
    .filter((a) => !a.connectedAt || a.connectedAt.getTime() <= data.issuedAt.getTime())
    .map((a) => a.id);
}
