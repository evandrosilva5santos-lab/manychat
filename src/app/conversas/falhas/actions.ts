"use server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { invalidIdMessage } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { getCurrentAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { executeFlow } from "@/lib/engine/runner";

export type FailedSendItem = {
  messageId: string;
  text: string | null;
  kind: string;
  error: string;
  createdAt: string;
  contactUsername: string | null;
  contactIgsid: string;
  flowName: string | null;
  runStatus: string | null;
  retryable: boolean; // apenas TEXT de run FAILED pode ser reenviado hoje
};

export type DeadEventItem = {
  id: string;
  type: string;
  attempts: number;
  lastError: string | null;
  receivedAt: string;
};

/**
 * Envios que a Meta recusou (Message.error preenchido) — nada falha
 * invisível. Ordenados do mais recente.
 */
export async function listFailedSends(): Promise<FailedSendItem[]> {
  await requireAuth();
  const account = await getCurrentAccount();
  if (!account) return [];

  const messages = await prisma.message.findMany({
    where: { accountId: account.id, direction: "OUT", error: { not: null } },
    include: {
      contact: { select: { username: true, igsid: true } },
      flow: { select: { name: true } },
      run: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return messages.map((m) => ({
    messageId: m.id,
    text: m.text,
    kind: m.kind,
    error: m.error || "Erro desconhecido",
    createdAt: m.createdAt.toISOString(),
    contactUsername: m.contact.username,
    contactIgsid: m.contact.igsid,
    flowName: m.flow?.name || null,
    runStatus: m.run?.status || null,
    retryable: m.kind === "TEXT" && Boolean(m.runId) && Boolean(m.nodeId) && m.run?.status === "FAILED",
  }));
}

/** Eventos que morreram na fila (DEAD) ou falharam de vez (FAILED). */
export async function listDeadEvents(): Promise<DeadEventItem[]> {
  await requireAuth();

  const events = await prisma.webhookEvent.findMany({
    where: { status: { in: ["DEAD", "FAILED"] } },
    orderBy: { receivedAt: "desc" },
    take: 20,
  });

  return events.map((e) => ({
    id: e.id,
    type: e.type,
    attempts: e.attempts,
    lastError: e.lastError,
    receivedAt: e.receivedAt.toISOString(),
  }));
}

export type RetryResult = { ok: true } | { ok: false; error: string };

/**
 * Wrapper para `<form action={...}>`, que exige retorno void. Falhas do
 * reenvio ficam registradas no console e o painel revalidado reflete o
 * estado real (a mensagem continua listada se recusada de novo).
 */
export async function retryFailedSendForm(formData: FormData): Promise<void> {
  const result = await retryFailedSend(formData);
  if (!result.ok) {
    console.error("[falhas] Reenvio falhou:", result.error);
  }
  revalidatePath("/conversas/falhas");
}

/**
 * Reenvia uma mensagem de texto que falhou e retoma o fluxo dali.
 * Só mensagens TEXT de runs FAILED (botões/carrossel sem reenvio ainda).
 */
export async function retryFailedSend(formData: FormData): Promise<RetryResult> {
  await requireAuth();
  const messageId = String(formData.get("messageId") || "");
  const invalidInput = invalidIdMessage(messageId);
  if (invalidInput) return { ok: false, error: invalidInput };

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { contact: true, run: true },
  });
  if (!message || !message.contact || !message.run) {
    return { ok: false, error: "Mensagem não encontrada" };
  }
  if (message.kind !== "TEXT") {
    return { ok: false, error: "Reenvio disponível apenas para mensagens de texto" };
  }
  if (message.run.status !== "FAILED" || !message.nodeId) {
    return { ok: false, error: "Execução não está em estado de reenvio" };
  }

  const account = await getCurrentAccount();
  if (!account) return { ok: false, error: "Sem conta conectada" };

  // Reexecuta a partir do nó que falhou: envia de novo e segue o fluxo.
  await prisma.flowRun.update({
    where: { id: message.run.id },
    data: { status: "RUNNING", error: null, currentNodeId: message.nodeId, finishedAt: null },
  });

  try {
    const result = await executeFlow({
      accountId: message.accountId,
      contact: message.contact,
      flowId: message.run.flowId,
      runId: message.run.id,
      startNodeId: message.nodeId,
    });
    revalidatePath("/conversas/falhas");
    if (result && "failed" in result && result.failed) {
      return { ok: false, error: "Reenvio recusado novamente pela Meta" };
    }
    return { ok: true };
  } catch (error) {
    revalidatePath("/conversas/falhas");
    return { ok: false, error: error instanceof Error ? error.message : "Falha no reenvio" };
  }
}
