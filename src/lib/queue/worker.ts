import { prisma } from "@/lib/prisma";
import { getCurrentAccount } from "@/lib/account";
import { defaultGraphClient } from "@/lib/meta/graph";
import {
  recordIncomingMessage,
  recordOutgoingMessage,
  getOrCreateContact,
} from "@/lib/engine/contacts";
import { findMatchingTrigger } from "@/lib/engine/matcher";
import { executeFlow, resumeFlowOnClick, resumeFlowOnMessage } from "@/lib/engine/runner";
import { decodePostback } from "@/lib/meta/postback";
import {
  claimEvent,
  findDueEventIds,
  markDone,
  markPermanent,
  markRetryable,
  reclaimStuckEvents,
} from "./store";
import { PermanentError } from "./errors";
import type { NormalizedWebhookEvent } from "@/lib/meta/webhook";

export type TickSummary = {
  due: number;
  processed: number;
  retried: number;
  failed: number;
  skipped: number;
  stuckReclaimed: number;
};

/**
 * Processa os eventos vencidos da fila. Chamado por:
 *  - `after()` no webhook (caminho rápido, best-effort);
 *  - cron via POST /api/webhook/instagram/tick (caminho durável —
 *    pega também o que o `after()` perdeu e as esperas de DELAY).
 *
 * Nunca lança: cada evento é tratado isoladamente e uma falha de
 * infraestrutura apenas deixa o evento para o próximo tick.
 */
export async function processDueEvents(limit = 10): Promise<TickSummary> {
  const summary: TickSummary = {
    due: 0,
    processed: 0,
    retried: 0,
    failed: 0,
    skipped: 0,
    stuckReclaimed: 0,
  };

  try {
    summary.stuckReclaimed = await reclaimStuckEvents();
  } catch (error) {
    console.error("[worker] Falha ao reivindicar eventos presos:", error);
    return summary;
  }

  let ids: string[];
  try {
    ids = await findDueEventIds(limit);
  } catch (error) {
    console.error("[worker] Falha ao buscar eventos da fila:", error);
    return summary;
  }
  summary.due = ids.length;

  for (const id of ids) {
    let claimed = false;
    try {
      claimed = await claimEvent(id);
    } catch (error) {
      console.error(`[worker] Falha ao reivindicar ${id}:`, error);
      continue;
    }
    if (!claimed) {
      summary.skipped++;
      continue;
    }

    let event: NormalizedWebhookEvent | null = null;
    try {
      const row = await prisma.webhookEvent.findUnique({ where: { id } });
      event = row?.payload as unknown as NormalizedWebhookEvent;
    } catch (error) {
      console.error(`[worker] Falha ao carregar ${id}:`, error);
      continue; // fica em PROCESSING e é recuperado pelo reclaim
    }
    if (!event) {
      await markPermanent(id, "Payload do evento sumiu da fila");
      summary.failed++;
      continue;
    }

    try {
      const accountId = await processEvent(event);
      await markDone(id, accountId);
      summary.processed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof PermanentError) {
        await markPermanent(id, message);
        summary.failed++;
      } else {
        // RetryableError ou erro inesperado: bounded pelo MAX_ATTEMPTS → DEAD.
        await markRetryable(id, message);
        summary.retried++;
      }
      console.error(`[worker] Evento ${id} (${event.kind}) falhou: ${message}`);
    }
  }

  return summary;
}

/**
 * Resolve a conta destinatária pelo entry.id do evento (roteamento por
 * conta) com fallback para a conta atual. Sobreposição mínima e
 * documentada com o item 3 (OAuth/roteamento).
 */
async function resolveAccount(igUserId: string) {
  const byEntry = await prisma.instagramAccount.findUnique({
    where: { igUserId },
  });
  if (byEntry) return byEntry;
  return getCurrentAccount();
}

/**
 * Processa UM evento normalizado: contato → histórico → gatilho → motor.
 * Retorna o accountId usado (para auditoria no WebhookEvent).
 * Lança RetryableError/PermanentError para a fila decidir o destino.
 */
export async function processEvent(event: NormalizedWebhookEvent): Promise<string | null> {
  const account = await resolveAccount(event.igUserId);
  if (!account) {
    throw new PermanentError(`Nenhuma conta Instagram conectada para entry ${event.igUserId}`);
  }

  const contact = await getOrCreateContact({
    accountId: account.id,
    igsid: event.userIgsid,
    username: "username" in event ? event.username : undefined,
    inboundAt: event.kind === "comment" ? undefined : new Date(event.timestamp),
  });

  // ── Comentário em post/reel ─────────────────────────────────
  if (event.kind === "comment") {
    const recorded = await recordIncomingMessage({
      accountId: account.id,
      contactId: contact.id,
      text: event.text,
      kind: "COMMENT",
      mediaId: event.mediaId,
      igMessageId: event.commentId,
    });
    if (!recorded) return account.id; // já processado — nada de DM duplicada

    const match = await findMatchingTrigger(account.id, event);
    if (match) {
      if (match.publicReply) {
        let client = defaultGraphClient;
        try {
          const { graphClientForAccount } = await import("@/lib/meta/account-client");
          client = await graphClientForAccount(account.id);
        } catch {
          client = defaultGraphClient;
        }
        const replyRes = await client.replyToComment(
          event.commentId,
          match.publicReply
        );
        await recordOutgoingMessage({
          accountId: account.id,
          contactId: contact.id,
          text: match.publicReply,
          kind: "COMMENT_REPLY",
          flowId: match.flow.id,
          error: replyRes.error,
        });
        // Falha na resposta pública não bloqueia a DM (registrada acima).
      }

      await executeFlow({
        accountId: account.id,
        contact,
        flowId: match.flow.id,
        startNodeId: match.startNodeId,
        triggerId: match.trigger.id,
        inboundText: event.text,
        triggerContext: {
          origin: "comment",
          commentId: event.commentId,
          mediaId: event.mediaId,
          timestamp: event.timestamp,
        },
      });
    }
    return account.id;
  }

  // ── Mensagem de texto no Direct ─────────────────────────────
  if (event.kind === "message") {
    const recorded = await recordIncomingMessage({
      accountId: account.id,
      contactId: contact.id,
      text: event.text,
      kind: "TEXT",
      igMessageId: event.messageId,
    });
    if (!recorded) return account.id;

    // Se o contato estava com um fluxo aguardando resposta (WAITING_REPLY), retoma a automação
    const resumed = await resumeFlowOnMessage({
      accountId: account.id,
      contact,
      inboundText: event.text,
    });
    if (resumed && "success" in resumed && resumed.success) return account.id;

    const match = await findMatchingTrigger(account.id, event);
    if (match) {
      await executeFlow({
        accountId: account.id,
        contact,
        flowId: match.flow.id,
        startNodeId: match.startNodeId,
        triggerId: match.trigger.id,
        inboundText: event.text,
        triggerContext: {
          origin: event.isStoryReply ? "story_reply" : "message",
          timestamp: event.timestamp,
        },
      });
    }
    return account.id;
  }

  // ── Clique em botão (postback) ──────────────────────────────
  const recorded = await recordIncomingMessage({
    accountId: account.id,
    contactId: contact.id,
    text: event.title,
    kind: "POSTBACK",
    payload: { payload: event.payload },
    igMessageId: event.postbackMid ?? event.messageId,
  });
  if (!recorded) return account.id;

  // 1. Postback com codificação resiliente (Item 03)
  const decoded = decodePostback(event.payload);
  if (decoded) {
    await resumeFlowOnClick({
      accountId: account.id,
      contact,
      nodeId: decoded.nodeId,
      buttonId: decoded.buttonId,
      payload: event.payload,
    });
    return account.id;
  }
  if (event.payload.startsWith("fluxo:")) {
    // Postback interno malformado não cai em gatilhos não relacionados
    return account.id;
  }

  // 2. Botão do Follow Gate legado (gate:nodeId)
  if (event.payload.startsWith("gate:")) {
    const nodeId = event.payload.replace("gate:", "");
    await resumeFlowOnClick({
      accountId: account.id,
      contact,
      nodeId,
      payload: event.payload,
    });
    return account.id;
  }

  // 3. Botão de Pergunta legado (node:nodeId_btn_btnId)
  if (event.payload.startsWith("node:")) {
    const match = event.payload.match(/^node:([^_]+)(?:_btn_(.+))?$/);
    if (match) {
      const [, nodeId, buttonId] = match;
      await resumeFlowOnClick({
        accountId: account.id,
        contact,
        nodeId,
        buttonId,
        payload: event.payload,
      });
    }
    return account.id;
  }

  // 3. Gatilho independente de clique
  const match = await findMatchingTrigger(account.id, event);
  if (match) {
    await executeFlow({
      accountId: account.id,
      contact,
      flowId: match.flow.id,
      startNodeId: match.startNodeId,
      triggerId: match.trigger.id,
    });
  }
  return account.id;
}

/**
 * Retoma runs paradas em DELAY cuja espera venceu. Complementa o item 5
 * (agendador externo): enquanto não houver QStash/Inngest, o cron do /tick
 * faz as esperas funcionarem.
 */
export async function resumeDueDelays(limit = 10): Promise<number> {
  const due = await prisma.flowRun.findMany({
    where: { status: "WAITING_DELAY", resumeAt: { lte: new Date() } },
    orderBy: { resumeAt: "asc" },
    take: limit,
    select: { id: true, flowId: true, contactId: true },
  });

  let resumed = 0;
  for (const run of due) {
    const claim = await prisma.flowRun.updateMany({
      where: { id: run.id, status: "WAITING_DELAY" },
      data: { status: "RUNNING" },
    });
    if (claim.count !== 1) continue;

    const contact = await prisma.contact.findUnique({ where: { id: run.contactId } });
    if (!contact) continue;

    try {
      await executeFlow({
        accountId: contact.accountId,
        contact,
        flowId: run.flowId,
        runId: run.id,
      });
      resumed++;
    } catch (error) {
      // Erro aqui já foi registrado pelo runner (run FAILED ou volta pro nó).
      console.error(`[worker] Falha ao retomar run ${run.id}:`, error);
    }
  }
  return resumed;
}
