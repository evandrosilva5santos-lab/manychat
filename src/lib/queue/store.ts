import { prisma } from "@/lib/prisma";
import type { NormalizedWebhookEvent } from "@/lib/meta/webhook";
import type { WebhookEvent } from "@/generated/prisma/client";

export const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 30_000; // 30s, 1min, 2min, 4min, 8min…
const MAX_BACKOFF_MS = 15 * 60_000;
/** Execução claimed há mais que isso é considerada morta (worker
 * congelado) e volta pra fila. */
export const STUCK_CLAIM_MS = 5 * 60_000;

/** Erro de "chave duplicada" do Postgres via Prisma. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Atraso exponencial entre tentativas (30s → cap de 15min).
 * Exportado para teste; não usar aleatoriedade (determinístico).
 */
export function backoffDelayMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
}

export type EnqueueResult = { event: WebhookEvent } | { duplicate: true };

/**
 * Grava o evento ANTES de qualquer processamento. P2002 = entrega
 * duplicada da Meta → o chamador responde 200 e não processa de novo.
 * Qualquer outro erro sobe (o webhook deve devolver 500 para a Meta
 * reentregar).
 */
export async function enqueueEvent(params: {
  idempotencyKey: string;
  type: string;
  payload: NormalizedWebhookEvent;
}): Promise<EnqueueResult> {
  try {
    const event = await prisma.webhookEvent.create({
      data: {
        idempotencyKey: params.idempotencyKey,
        type: params.type,
        payload: params.payload as unknown as object,
      },
    });
    return { event };
  } catch (error) {
    if (isUniqueViolation(error)) return { duplicate: true };
    throw error;
  }
}

/**
 * Reivindicação ATÔMICA de um evento: só passa o worker que mudar o
 * status para PROCESSING. count === 1 significa "eu sou o dono agora".
 */
export async function claimEvent(id: string): Promise<boolean> {
  const result = await prisma.webhookEvent.updateMany({
    where: {
      id,
      status: { in: ["RECEIVED", "FAILED"] },
      nextAttemptAt: { lte: new Date() },
    },
    data: { status: "PROCESSING", claimedAt: new Date() },
  });
  return result.count === 1;
}

export async function markDone(id: string, accountId?: string | null): Promise<void> {
  await prisma.webhookEvent.update({
    where: { id },
    data: {
      status: "DONE",
      processedAt: new Date(),
      lastError: null,
      ...(accountId !== undefined ? { accountId } : {}),
    },
  });
}

/**
 * Falha retentável: volta para RECEIVED com backoff. Esgotadas as
 * tentativas, vira DEAD (terminal, com alerta no painel).
 */
export async function markRetryable(id: string, error: string): Promise<void> {
  const event = await prisma.webhookEvent.findUnique({ where: { id }, select: { attempts: true } });
  const attempts = (event?.attempts ?? 0) + 1;
  const dead = attempts >= MAX_ATTEMPTS;

  await prisma.webhookEvent.update({
    where: { id },
    data: {
      status: dead ? "DEAD" : "RECEIVED",
      attempts,
      lastError: error.slice(0, 500),
      nextAttemptAt: new Date(Date.now() + backoffDelayMs(attempts)),
      processedAt: dead ? new Date() : null,
    },
  });

  if (dead) {
    console.error(`[queue] Evento ${id} morto após ${attempts} tentativas: ${error}`);
  }
}

/** Falha permanente (4xx definitivo, bug): registrado, sem retentativa. */
export async function markPermanent(id: string, error: string): Promise<void> {
  await prisma.webhookEvent.update({
    where: { id },
    data: {
      status: "FAILED",
      lastError: error.slice(0, 500),
      processedAt: new Date(),
    },
  });
}

/**
 * Devolve à fila eventos presos em PROCESSING (worker morreu no meio).
 * Incrementa attempts para não loopar infinito em crash repetido.
 */
export async function reclaimStuckEvents(olderThanMs: number = STUCK_CLAIM_MS): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const stuck = await prisma.webhookEvent.findMany({
    where: { status: "PROCESSING", claimedAt: { lt: cutoff } },
    select: { id: true, attempts: true },
  });

  for (const event of stuck) {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: "RECEIVED",
        attempts: event.attempts + 1,
        lastError: "Worker interrompido durante o processamento",
        nextAttemptAt: new Date(),
      },
    });
  }
  return stuck.length;
}

/** IDs de eventos prontos para processar, na ordem. */
export async function findDueEventIds(limit: number): Promise<string[]> {
  const events = await prisma.webhookEvent.findMany({
    where: { status: "RECEIVED", nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: "asc" },
    select: { id: true },
    take: limit,
  });
  return events.map((e) => e.id);
}
